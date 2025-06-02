const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Get all intersection data with pagination
router.get("/", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { page = 1, limit = 50, intersection_id, sensor_id, sensor_direction, start, end } = req.query

    const filter = {}

    // Filter by intersection ID if provided
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by sensor direction if provided (enhanced feature)
    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Filter by time range if provided
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        filter.timestamp.$gte = new Date(start)
      }
      if (end) {
        filter.timestamp.$lte = new Date(end)
      }
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const data = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .toArray()

    const total = await collection.countDocuments(filter)

    res.json({
      data,
      pagination: {
        total,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch intersection data" })
  }
})

// Get intersection coordination status (NEW ENHANCED ENDPOINT)
router.get("/:id/coordination", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { id } = req.params

    // Get latest coordination data for this intersection
    const coordinationData = await collection
      .find({ intersection_id: id })
      .sort({ timestamp: -1 })
      .limit(4) // Get data from all 4 sensors
      .toArray()

    if (coordinationData.length === 0) {
      return res.status(404).json({ error: "Intersection not found" })
    }

    // Group by sensor direction
    const sensorData = coordinationData.reduce((acc, data) => {
      const direction = data.sensor_direction || 'unknown'
      acc[direction] = {
        sensor_id: data.sensor_id,
        coordinated_light_status: data.coordinated_light_status,
        intersection_efficiency: data.intersection_efficiency,
        total_intersection_vehicles: data.total_intersection_vehicles,
        phase_time_remaining: data.phase_time_remaining,
        coordinated_weather: data.coordinated_weather,
        vehicle_flow_rate: data.vehicle_flow_rate,
        queue_propagation_factor: data.queue_propagation_factor,
        timestamp: data.timestamp
      }
      return acc
    }, {})

    // Calculate overall coordination metrics
    const overallEfficiency = coordinationData.reduce((sum, data) => 
      sum + (data.intersection_efficiency || 0), 0) / coordinationData.length

    const totalVehicles = coordinationData.reduce((sum, data) => 
      sum + (data.total_intersection_vehicles || 0), 0)

    res.json({
      intersection_id: id,
      sensors: sensorData,
      coordination_summary: {
        overall_efficiency: overallEfficiency,
        total_vehicles: totalVehicles,
        active_sensors: coordinationData.length,
        last_update: coordinationData[0].timestamp
      }
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch intersection coordination data" })
  }
})

// Get weather synchronization data (NEW ENHANCED ENDPOINT)
router.get("/:id/weather-sync", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    const { id } = req.params

    // First, try to get data with enhanced coordinated_weather field
    let weatherData = await collection
      .find({ 
        intersection_id: id,
        coordinated_weather: { $exists: true }
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray()

    // If no enhanced weather data, fall back to local_weather_conditions
    if (weatherData.length === 0) {
      weatherData = await collection
        .find({ 
          intersection_id: id,
          local_weather_conditions: { $exists: true }
        })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()
    }

    // If still no data, try any data for this intersection
    if (weatherData.length === 0) {
      weatherData = await collection
        .find({ intersection_id: id })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()
    }

    // Try to get detailed weather data from traffic collection for the same intersection
    let detailedWeatherData = []
    if (weatherData.length > 0) {
      detailedWeatherData = await trafficCollection
        .find({ 
          intersection_id: id,
          $or: [
            { temperature: { $exists: true } },
            { humidity: { $exists: true } },
            { wind_speed: { $exists: true } }
          ]
        })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()
    }

    if (weatherData.length === 0) {
      return res.status(404).json({ 
        error: "No weather synchronization data found",
        intersection_id: id,
        suggestion: "Check if intersection data exists for this ID"
      })
    }

    // Determine weather data source and format response accordingly
    const hasEnhancedWeather = weatherData[0].coordinated_weather
    const hasDetailedWeather = detailedWeatherData.length > 0

    const weatherHistory = weatherData.map((data, index) => {
      if (data.coordinated_weather) {
        // Enhanced weather format (complete weather object)
        return {
          weather_state: data.coordinated_weather,
          timestamp: data.timestamp,
          sensor_id: data.sensor_id,
          enhanced: true
        }
      } else {
        // Basic weather format - only include non-null fields
        const weatherState = {
          conditions: data.local_weather_conditions || "unknown",
          visibility: data.fog_or_smoke_detected ? "reduced" : "good"
        }

        // Try to get detailed weather from traffic data for similar timestamp
        if (hasDetailedWeather) {
          const matchingTrafficData = detailedWeatherData.find(td => 
            Math.abs(new Date(td.timestamp) - new Date(data.timestamp)) < 60000 // Within 1 minute
          )
          
          if (matchingTrafficData) {
            if (matchingTrafficData.temperature !== undefined && matchingTrafficData.temperature !== null) {
              weatherState.temperature = matchingTrafficData.temperature
            }
            if (matchingTrafficData.humidity !== undefined && matchingTrafficData.humidity !== null) {
              weatherState.humidity = matchingTrafficData.humidity
            }
            if (matchingTrafficData.wind_speed !== undefined && matchingTrafficData.wind_speed !== null) {
              weatherState.wind_speed = matchingTrafficData.wind_speed
            }
          }
        }

        return {
          weather_state: weatherState,
          timestamp: data.timestamp,
          sensor_id: data.sensor_id,
          enhanced: false
        }
      }
    })

    // Create current weather object - only include non-null fields
    let currentWeather
    if (hasEnhancedWeather) {
      currentWeather = weatherData[0].coordinated_weather
    } else {
      currentWeather = {
        conditions: weatherData[0].local_weather_conditions || "unknown",
        visibility: weatherData[0].fog_or_smoke_detected ? "reduced" : "good"
      }

      // Try to add detailed weather from most recent traffic data
      if (hasDetailedWeather && detailedWeatherData[0]) {
        const latestTrafficData = detailedWeatherData[0]
        if (latestTrafficData.temperature !== undefined && latestTrafficData.temperature !== null) {
          currentWeather.temperature = latestTrafficData.temperature
        }
        if (latestTrafficData.humidity !== undefined && latestTrafficData.humidity !== null) {
          currentWeather.humidity = latestTrafficData.humidity
        }
        if (latestTrafficData.wind_speed !== undefined && latestTrafficData.wind_speed !== null) {
          currentWeather.wind_speed = latestTrafficData.wind_speed
        }
      }
    }

    res.json({
      intersection_id: id,
      current_weather: currentWeather,
      weather_history: weatherHistory,
      data_source: hasEnhancedWeather ? "coordinated_weather" : "local_weather_conditions",
      detailed_weather_available: hasDetailedWeather,
      total_records: weatherData.length,
      last_update: weatherData[0].timestamp
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch weather synchronization data" })
  }
})

// Get intersection efficiency metrics (NEW ENHANCED ENDPOINT)
router.get("/:id/efficiency", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { id } = req.params
    const { hours = 24 } = req.query

    console.log("=== EFFICIENCY ENDPOINT DEBUG ===")
    console.log("Intersection ID:", id)
    console.log("Hours requested:", hours)

    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000)
    console.log("Time filter (hours ago):", hoursAgo.toISOString())

    // First, try to get data with enhanced intersection_efficiency field
    let efficiencyData = await collection
      .find({ 
        intersection_id: id,
        timestamp: { $gte: hoursAgo },
        intersection_efficiency: { $exists: true }
      })
      .sort({ timestamp: 1 })
      .toArray()

    console.log("Enhanced efficiency data found:", efficiencyData.length)

    // If no enhanced efficiency data, calculate from basic intersection metrics
    if (efficiencyData.length === 0) {
      console.log("No enhanced data, trying basic data with time filter...")
      const basicData = await collection
        .find({ 
          intersection_id: id,
          timestamp: { $gte: hoursAgo }
        })
        .sort({ timestamp: 1 })
        .toArray()

      console.log("Basic data with time filter found:", basicData.length)

      // If no data in time range, try without time filter
      if (basicData.length === 0) {
        console.log("No data in time range, trying without time filter...")
        const allData = await collection
          .find({ intersection_id: id })
          .sort({ timestamp: -1 })
          .limit(100) // Get latest 100 records
          .toArray()

        console.log("All data (latest 100) found:", allData.length)

        if (allData.length === 0) {
          // Check what intersection IDs are actually available
          const availableIntersections = await collection.distinct("intersection_id")
          console.log("Available intersection IDs:", availableIntersections)

          return res.status(404).json({ 
            error: "No efficiency data found",
            intersection_id: id,
            available_intersections: availableIntersections,
            suggestion: availableIntersections.length > 0 
              ? `Try one of these intersection IDs: ${availableIntersections.join(", ")}`
              : "No intersection data available in the database"
          })
        }

        // Use the latest data but inform about time range issue
        console.log("Using latest available data instead of time-filtered data")
        const latestTimestamp = allData[0].timestamp
        const dataAge = (Date.now() - new Date(latestTimestamp).getTime()) / (1000 * 60 * 60)
        console.log("Latest data age (hours):", Math.round(dataAge * 100) / 100)

        // Calculate efficiency from all available data (instead of basicData)
        efficiencyData = allData.map(data => {
          // Calculate efficiency score (0.0 to 1.0) based on available metrics
          let efficiencyScore = 1.0 // Start with perfect efficiency

          // Factor 1: Average wait time (lower is better)
          if (data.average_wait_time !== undefined && data.average_wait_time !== null) {
            const waitTimePenalty = Math.min(data.average_wait_time / 120, 1) // Normalize to 0-1 (120s = max penalty)
            efficiencyScore -= waitTimePenalty * 0.3 // 30% weight
          }

          // Factor 2: Lane occupancy (moderate levels are optimal)
          if (data.lane_occupancy !== undefined && data.lane_occupancy !== null) {
            const optimalOccupancy = 65 // 65% is considered optimal
            const occupancyDeviation = Math.abs(data.lane_occupancy - optimalOccupancy) / 100
            efficiencyScore -= occupancyDeviation * 0.2 // 20% weight
          }

          // Factor 3: Stopped vehicles count (lower is better)
          if (data.stopped_vehicles_count !== undefined && data.stopped_vehicles_count !== null) {
            const stoppedPenalty = Math.min(data.stopped_vehicles_count / 50, 1) // Normalize (50 vehicles = max penalty)
            efficiencyScore -= stoppedPenalty * 0.2 // 20% weight
          }

          // Factor 4: Traffic light compliance (higher is better)
          if (data.traffic_light_compliance_rate !== undefined && data.traffic_light_compliance_rate !== null) {
            const complianceBonus = (data.traffic_light_compliance_rate / 100) * 0.1 // 10% weight
            efficiencyScore = Math.min(efficiencyScore + complianceBonus, 1.0)
          }

          // Factor 5: Risky behavior (presence reduces efficiency)
          if (data.risky_behavior_detected === true) {
            efficiencyScore -= 0.1 // 10% penalty
          }

          // Factor 6: Intersection blocking vehicles (major penalty)
          if (data.intersection_blocking_vehicles !== undefined && data.intersection_blocking_vehicles !== null) {
            const blockingPenalty = Math.min(data.intersection_blocking_vehicles / 10, 0.2) // Max 20% penalty
            efficiencyScore -= blockingPenalty
          }

          // Ensure efficiency is between 0.0 and 1.0
          const calculatedEfficiency = Math.max(0.0, Math.min(1.0, efficiencyScore))

          return {
            ...data,
            intersection_efficiency: calculatedEfficiency,
            efficiency_calculated: true
          }
        })

        // Build efficiency response with data age warning
        console.log("Final efficiency data count:", efficiencyData.length)

        // Calculate efficiency trends
        const hourlyEfficiency = {}
        efficiencyData.forEach(data => {
          const hour = new Date(data.timestamp).getHours()
          if (!hourlyEfficiency[hour]) {
            hourlyEfficiency[hour] = []
          }
          hourlyEfficiency[hour].push(data.intersection_efficiency)
        })

        const efficiencyTrends = Object.entries(hourlyEfficiency).map(([hour, values]) => ({
          hour: parseInt(hour),
          average_efficiency: values.reduce((sum, val) => sum + val, 0) / values.length,
          max_efficiency: Math.max(...values),
          min_efficiency: Math.min(...values),
          data_points: values.length
        }))

        const currentEfficiency = efficiencyData[efficiencyData.length - 1].intersection_efficiency
        const averageEfficiency = efficiencyData.reduce((sum, data) => sum + data.intersection_efficiency, 0) / efficiencyData.length

        console.log("=== EFFICIENCY ENDPOINT SUCCESS (USING OLD DATA) ===")

        return res.json({
          intersection_id: id,
          current_efficiency: Math.round(currentEfficiency * 100) / 100,
          average_efficiency: Math.round(averageEfficiency * 100) / 100,
          efficiency_trends: efficiencyTrends.map(trend => ({
            ...trend,
            average_efficiency: Math.round(trend.average_efficiency * 100) / 100,
            max_efficiency: Math.round(trend.max_efficiency * 100) / 100,
            min_efficiency: Math.round(trend.min_efficiency * 100) / 100
          })),
          data_period_hours: hours,
          data_source: "calculated_from_basic_metrics",
          data_age_hours: Math.round(dataAge * 100) / 100,
          warning: `No data found within ${hours} hours. Using latest available data which is ${Math.round(dataAge * 100) / 100} hours old.`,
          calculation_factors: [
            "average_wait_time (30% weight)",
            "lane_occupancy (20% weight)", 
            "stopped_vehicles_count (20% weight)",
            "traffic_light_compliance_rate (10% weight)",
            "risky_behavior_detected (10% penalty)",
            "intersection_blocking_vehicles (up to 20% penalty)"
          ],
          total_records: efficiencyData.length
        })
      } else {
        // Calculate efficiency from basic data within time range
        efficiencyData = basicData.map(data => {
          // Calculate efficiency score (0.0 to 1.0) based on available metrics
          let efficiencyScore = 1.0 // Start with perfect efficiency

          // Factor 1: Average wait time (lower is better)
          if (data.average_wait_time !== undefined && data.average_wait_time !== null) {
            const waitTimePenalty = Math.min(data.average_wait_time / 120, 1) // Normalize to 0-1 (120s = max penalty)
            efficiencyScore -= waitTimePenalty * 0.3 // 30% weight
          }

          // Factor 2: Lane occupancy (moderate levels are optimal)
          if (data.lane_occupancy !== undefined && data.lane_occupancy !== null) {
            const optimalOccupancy = 65 // 65% is considered optimal
            const occupancyDeviation = Math.abs(data.lane_occupancy - optimalOccupancy) / 100
            efficiencyScore -= occupancyDeviation * 0.2 // 20% weight
          }

          // Factor 3: Stopped vehicles count (lower is better)
          if (data.stopped_vehicles_count !== undefined && data.stopped_vehicles_count !== null) {
            const stoppedPenalty = Math.min(data.stopped_vehicles_count / 50, 1) // Normalize (50 vehicles = max penalty)
            efficiencyScore -= stoppedPenalty * 0.2 // 20% weight
          }

          // Factor 4: Traffic light compliance (higher is better)
          if (data.traffic_light_compliance_rate !== undefined && data.traffic_light_compliance_rate !== null) {
            const complianceBonus = (data.traffic_light_compliance_rate / 100) * 0.1 // 10% weight
            efficiencyScore = Math.min(efficiencyScore + complianceBonus, 1.0)
          }

          // Factor 5: Risky behavior (presence reduces efficiency)
          if (data.risky_behavior_detected === true) {
            efficiencyScore -= 0.1 // 10% penalty
          }

          // Factor 6: Intersection blocking vehicles (major penalty)
          if (data.intersection_blocking_vehicles !== undefined && data.intersection_blocking_vehicles !== null) {
            const blockingPenalty = Math.min(data.intersection_blocking_vehicles / 10, 0.2) // Max 20% penalty
            efficiencyScore -= blockingPenalty
          }

          // Ensure efficiency is between 0.0 and 1.0
          const calculatedEfficiency = Math.max(0.0, Math.min(1.0, efficiencyScore))

          return {
            ...data,
            intersection_efficiency: calculatedEfficiency,
            efficiency_calculated: true
          }
        })
      }
    }

    console.log("Final efficiency data count:", efficiencyData.length)

    // Calculate efficiency trends
    const hourlyEfficiency = {}
    efficiencyData.forEach(data => {
      const hour = new Date(data.timestamp).getHours()
      if (!hourlyEfficiency[hour]) {
        hourlyEfficiency[hour] = []
      }
      hourlyEfficiency[hour].push(data.intersection_efficiency)
    })

    const efficiencyTrends = Object.entries(hourlyEfficiency).map(([hour, values]) => ({
      hour: parseInt(hour),
      average_efficiency: values.reduce((sum, val) => sum + val, 0) / values.length,
      max_efficiency: Math.max(...values),
      min_efficiency: Math.min(...values),
      data_points: values.length
    }))

    const currentEfficiency = efficiencyData[efficiencyData.length - 1].intersection_efficiency
    const averageEfficiency = efficiencyData.reduce((sum, data) => sum + data.intersection_efficiency, 0) / efficiencyData.length

    // Determine data source
    const isCalculated = efficiencyData.length > 0 && efficiencyData[0].efficiency_calculated
    const dataSource = isCalculated ? "calculated_from_basic_metrics" : "intersection_efficiency_field"

    console.log("=== EFFICIENCY ENDPOINT SUCCESS ===")

    res.json({
      intersection_id: id,
      current_efficiency: Math.round(currentEfficiency * 100) / 100, // Round to 2 decimal places
      average_efficiency: Math.round(averageEfficiency * 100) / 100,
      efficiency_trends: efficiencyTrends.map(trend => ({
        ...trend,
        average_efficiency: Math.round(trend.average_efficiency * 100) / 100,
        max_efficiency: Math.round(trend.max_efficiency * 100) / 100,
        min_efficiency: Math.round(trend.min_efficiency * 100) / 100
      })),
      data_period_hours: hours,
      data_source: dataSource,
      calculation_factors: isCalculated ? [
        "average_wait_time (30% weight)",
        "lane_occupancy (20% weight)", 
        "stopped_vehicles_count (20% weight)",
        "traffic_light_compliance_rate (10% weight)",
        "risky_behavior_detected (10% penalty)",
        "intersection_blocking_vehicles (up to 20% penalty)"
      ] : null,
      total_records: efficiencyData.length
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch efficiency data" })
  }
})

// Get 4-sensor overview for intersection (NEW ENHANCED ENDPOINT)
router.get("/:id/sensors", async (req, res) => {
  const db = Database.getInstance()
  try {
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    const { id } = req.params

    console.log(`=== SENSORS ENDPOINT DEBUG ===`)
    console.log(`Intersection ID: ${id}`)

    // First, get direction data from traffic_metrics (which has sensor_direction)
    const trafficPipeline = [
      {
        $match: { 
          intersection_id: id,
          sensor_direction: { $exists: true, $ne: null }
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: "$sensor_direction",
          latest_data: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$latest_data" }
      }
    ]

    let sensorData = await trafficCollection.aggregate(trafficPipeline).toArray()
    console.log(`Traffic data with sensor_direction: ${sensorData.length} sensors`)

    // Get intersection data for the same intersection (has stopped_vehicles_count, average_wait_time)
    const intersectionPipeline = [
      {
        $match: { intersection_id: id }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: "$sensor_id",
          latest_data: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$latest_data" }
      }
    ]

    const intersectionData = await intersectionCollection.aggregate(intersectionPipeline).toArray()
    console.log(`Intersection data: ${intersectionData.length} sensors`)

    // Create a map of sensor_id -> intersection data for easy lookup
    const intersectionMap = {}
    intersectionData.forEach(data => {
      intersectionMap[data.sensor_id] = data
    })

    // Function to determine direction from sensor ID or location
    const inferDirection = (sensor_id, location_id) => {
      const sensorStr = (sensor_id || '').toLowerCase()
      const locationStr = (location_id || '').toLowerCase()
      
      if (sensorStr.includes('north') || locationStr.includes('-n') || locationStr.includes('north')) return 'north'
      if (sensorStr.includes('south') || locationStr.includes('-s') || locationStr.includes('south')) return 'south'
      if (sensorStr.includes('east') || locationStr.includes('-e') || locationStr.includes('east')) return 'east'
      if (sensorStr.includes('west') || locationStr.includes('-w') || locationStr.includes('west')) return 'west'
      
      return 'unknown'
    }

    // Organize by direction
    const directionMap = {
      'north': null,
      'south': null,
      'east': null,
      'west': null
    }

    // Process traffic data (which has accurate sensor_direction) and merge with intersection data
    sensorData.forEach(trafficData => {
      const direction = trafficData.sensor_direction
      if (directionMap.hasOwnProperty(direction)) {
        // Get corresponding intersection data for this sensor
        const intersectionData = intersectionMap[trafficData.sensor_id] || {}
        
        directionMap[direction] = {
          sensor_id: trafficData.sensor_id,
          // From traffic data (traffic_metrics collection)
          vehicle_flow_rate: trafficData.vehicle_flow_rate,
          queue_propagation_factor: trafficData.queue_propagation_factor,
          traffic_light_phase: trafficData.traffic_light_phase,
          coordinated_weather: trafficData.coordinated_weather,
          // From intersection data (intersections collection)
          stopped_vehicles_count: intersectionData.stopped_vehicles_count || null,
          average_wait_time: intersectionData.average_wait_time || null,
          lane_occupancy: intersectionData.lane_occupancy || null,
          traffic_light_compliance_rate: intersectionData.traffic_light_compliance_rate || null,
          intersection_congestion_level: intersectionData.intersection_congestion_level || null,
          // Timestamps
          timestamp: trafficData.timestamp,
          intersection_timestamp: intersectionData.timestamp || null,
          data_source: 'merged_traffic_and_intersection'
        }
      }
    })

    // If we still have null directions, try to fill them from intersection data using inferred directions
    intersectionData.forEach(data => {
      const inferredDirection = inferDirection(data.sensor_id, data.location_id)
      
      // Only use if we don't already have this direction from traffic data
      if (directionMap[inferredDirection] === null && directionMap.hasOwnProperty(inferredDirection)) {
        directionMap[inferredDirection] = {
          sensor_id: data.sensor_id,
          vehicle_flow_rate: null, // Not available in intersection data
          queue_propagation_factor: null, // Not available in intersection data
          traffic_light_phase: null,
          coordinated_weather: null,
          stopped_vehicles_count: data.stopped_vehicles_count,
          average_wait_time: data.average_wait_time,
          lane_occupancy: data.lane_occupancy,
          traffic_light_compliance_rate: data.traffic_light_compliance_rate,
          intersection_congestion_level: data.intersection_congestion_level,
          timestamp: data.timestamp,
          intersection_timestamp: data.timestamp,
          data_source: 'intersections_only',
          inferred_direction: true
        }
      }
    })

    // Count actual sensors found
    const actualSensors = Object.values(directionMap).filter(sensor => sensor !== null)
    const totalSensors = Math.max(actualSensors.length, sensorData.length, intersectionData.length)

    console.log(`Final result: ${actualSensors.length} sensors mapped by direction`)
    console.log(`Direction mapping:`, Object.keys(directionMap).map(dir => `${dir}: ${directionMap[dir] ? 'FOUND' : 'NULL'}`))

    res.json({
      intersection_id: id,
      sensors_by_direction: directionMap,
      total_sensors: totalSensors,
      sensors_with_direction: actualSensors.length,
      sensors_with_complete_data: actualSensors.filter(s => s.stopped_vehicles_count !== null).length,
      last_update: actualSensors.length > 0 ? Math.max(...actualSensors.map(d => new Date(d.timestamp).getTime())) : null,
      debug: {
        traffic_data_sources: sensorData.length,
        intersection_data_sources: intersectionData.length,
        direction_mapping_successful: actualSensors.length > 0,
        data_merge_successful: actualSensors.filter(s => s.stopped_vehicles_count !== null).length > 0
      }
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch sensor overview" })
  }
})

// Get intersection statistics
router.get("/stats", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== INTERSECTION STATS DEBUG ===")
    console.log("Collection name:", config.INTERSECTION_COLLECTION)
    
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { intersection_id, sensor_id, start, end } = req.query

    console.log("Query parameters:", { intersection_id, sensor_id, start, end })

    // Check if collection exists and has data
    const totalCount = await collection.countDocuments({})
    console.log("Total documents in collection:", totalCount)

    if (totalCount === 0) {
      console.log("⚠️ Intersection collection is empty")
      return res.json({
        congestionStats: [],
        queueStats: [],
        incidentStats: {},
        pedestrianStats: [],
        message: "No intersection data available"
      })
    }

    // Get a sample document to understand the structure
    const sampleDoc = await collection.findOne({})
    console.log("Sample document fields:", Object.keys(sampleDoc))
    console.log("Sample document intersection_congestion_level:", sampleDoc.intersection_congestion_level)

    const filter = {}

    // Filter by intersection ID if provided
    if (intersection_id) {
      filter.intersection_id = intersection_id
      
      // Check if this intersection exists
      const intersectionExists = await collection.countDocuments({ intersection_id })
      console.log(`Documents for intersection ${intersection_id}:`, intersectionExists)
      
      if (intersectionExists === 0) {
        const availableIntersections = await collection.distinct("intersection_id")
        console.log("Available intersections:", availableIntersections)
        return res.json({
          congestionStats: [],
          queueStats: [],
          incidentStats: {},
          pedestrianStats: [],
          message: `No data found for intersection ${intersection_id}`,
          available_intersections: availableIntersections
        })
      }
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by time range if provided
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        try {
          filter.timestamp.$gte = new Date(start)
        } catch (err) {
          console.error("Invalid start date:", start)
          return res.status(400).json({ error: "Invalid start date format" })
        }
      }
      if (end) {
        try {
          filter.timestamp.$lte = new Date(end)
        } catch (err) {
          console.error("Invalid end date:", end)
          return res.status(400).json({ error: "Invalid end date format" })
        }
      }
    }

    console.log("Final filter:", JSON.stringify(filter, null, 2))

    // Check how many documents match the filter
    const filteredCount = await collection.countDocuments(filter)
    console.log("Documents matching filter:", filteredCount)

    if (filteredCount === 0) {
      return res.json({
        congestionStats: [],
        queueStats: [],
        incidentStats: {},
        pedestrianStats: [],
        message: "No data matches the specified filters"
      })
    }

    // Initialize results
    let congestionStats = []
    let queueStats = []
    let incidentStats = {}
    let pedestrianStats = []

    try {
      console.log("Executing congestion stats pipeline...")
      // Get congestion level distribution
      const congestionPipeline = [
        { $match: filter },
        {
          $group: {
            _id: "$intersection_congestion_level",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]

      congestionStats = await collection.aggregate(congestionPipeline).toArray()
      console.log("Congestion stats result:", congestionStats)
    } catch (error) {
      console.error("Congestion stats error:", error)
      congestionStats = []
    }

    try {
      console.log("Executing queue stats pipeline...")
      // Get queue length over time - with enhanced timestamp handling
      const queuePipeline = [
        { $match: filter },
        {
          $addFields: {
            // Handle timestamp conversion
            timestampDate: {
              $switch: {
                branches: [
                  {
                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                    then: "$timestamp"
                  },
                  {
                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                    then: {
                      $dateFromString: { 
                        dateString: "$timestamp",
                        onError: new Date() // Fallback to current date if parsing fails
                      }
                    }
                  }
                ],
                default: new Date() // Fallback for any other type
              }
            },
            // Handle queue length fields
            lane1: { 
              $ifNull: ["$queue_length_by_lane.lane1", 0] 
            },
            lane2: { 
              $ifNull: ["$queue_length_by_lane.lane2", 0] 
            },
            lane3: { 
              $ifNull: ["$queue_length_by_lane.lane3", 0] 
            }
          }
        },
        {
          $project: {
            hour: { $hour: "$timestampDate" },
            totalQueueLength: {
              $add: ["$lane1", "$lane2", "$lane3"]
            },
          },
        },
        {
          $group: {
            _id: "$hour",
            avgQueueLength: { $avg: "$totalQueueLength" },
            count: { $sum: 1 }
          },
        },
        { $sort: { _id: 1 } },
      ]

      queueStats = await collection.aggregate(queuePipeline).toArray()
      console.log("Queue stats result:", queueStats)
      
      // Debug: Check if we have queue data at all
      const queueDataCheck = await collection.findOne({ 
        ...filter, 
        queue_length_by_lane: { $exists: true } 
      })
      console.log("Queue data exists check:", !!queueDataCheck)
      
    } catch (error) {
      console.error("Queue stats error:", error)
      queueStats = []
    }

    try {
      console.log("Executing incident stats pipeline...")
      // Get incident statistics - with null safety
      const incidentPipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            totalCollisions: { 
              $sum: { $ifNull: ["$collision_count", 0] }
            },
            totalNearMisses: { 
              $sum: { $ifNull: ["$near_miss_incidents", 0] }
            },
            totalSuddenBraking: { 
              $sum: { $ifNull: ["$sudden_braking_events", 0] }
            },
            totalWrongWay: { 
              $sum: { $ifNull: ["$wrong_way_vehicles", 0] }
            },
            riskyBehaviorCount: {
              $sum: { 
                $cond: [
                  { $eq: ["$risky_behavior_detected", true] }, 
                  1, 
                  0
                ] 
              },
            },
            illegalParkingCount: {
              $sum: { 
                $cond: [
                  { $eq: ["$illegal_parking_detected", true] }, 
                  1, 
                  0
                ] 
              },
            },
          },
        },
      ]

      const incidentResult = await collection.aggregate(incidentPipeline).toArray()
      incidentStats = incidentResult[0] || {}
      // Remove the _id: null from the response
      if (incidentStats._id === null) {
        delete incidentStats._id
      }
      console.log("Incident stats result:", incidentStats)
    } catch (error) {
      console.error("Incident stats error:", error)
      incidentStats = {}
    }

    try {
      console.log("Executing pedestrian stats pipeline...")
      // Get pedestrian and cyclist activity - with enhanced timestamp handling
      const pedestrianPipeline = [
        { $match: filter },
        {
          $addFields: {
            // Handle timestamp conversion
            timestampDate: {
              $switch: {
                branches: [
                  {
                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                    then: "$timestamp"
                  },
                  {
                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                    then: {
                      $dateFromString: { 
                        dateString: "$timestamp",
                        onError: new Date() // Fallback to current date if parsing fails
                      }
                    }
                  }
                ],
                default: new Date() // Fallback for any other type
              }
            }
          }
        },
        {
          $group: {
            _id: { $hour: "$timestampDate" },
            avgPedestrians: { 
              $avg: { $ifNull: ["$pedestrians_crossing", 0] }
            },
            avgJaywalking: { 
              $avg: { $ifNull: ["$jaywalking_pedestrians", 0] }
            },
            avgCyclists: { 
              $avg: { $ifNull: ["$cyclists_crossing", 0] }
            },
            count: { $sum: 1 }
          },
        },
        { $sort: { _id: 1 } },
      ]

      pedestrianStats = await collection.aggregate(pedestrianPipeline).toArray()
      console.log("Pedestrian stats result:", pedestrianStats)
      
      // Debug: Check if we have pedestrian data at all
      const pedestrianDataCheck = await collection.findOne({ 
        ...filter, 
        pedestrians_crossing: { $exists: true } 
      })
      console.log("Pedestrian data exists check:", !!pedestrianDataCheck)
      
    } catch (error) {
      console.error("Pedestrian stats error:", error)
      pedestrianStats = []
    }

    console.log("=== INTERSECTION STATS SUCCESS ===")

    res.json({
      congestionStats,
      queueStats,
      incidentStats,
      pedestrianStats,
      metadata: {
        total_documents: totalCount,
        filtered_documents: filteredCount,
        collection: config.INTERSECTION_COLLECTION,
        filters_applied: filter
      }
    })
  } catch (error) {
    console.error("=== INTERSECTION STATS ERROR ===")
    console.error("Error details:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ 
      error: "Failed to fetch intersection statistics",
      details: error.message,
      collection: config.INTERSECTION_COLLECTION
    })
  }
})

// Get congestion heatmap data
router.get("/congestion", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== CONGESTION HEATMAP DEBUG ===")
    console.log("Collection name:", config.INTERSECTION_COLLECTION)
    
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { start, end } = req.query

    console.log("Query parameters:", { start, end })

    // Check if collection exists and has data
    const totalCount = await collection.countDocuments({})
    console.log("Total documents in collection:", totalCount)

    if (totalCount === 0) {
      console.log("⚠️ Intersection collection is empty")
      return res.json({})
    }

    const filter = {}

    // Filter by time range if provided
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        try {
          filter.timestamp.$gte = new Date(start)
        } catch (err) {
          console.error("Invalid start date:", start)
          return res.status(400).json({ error: "Invalid start date format" })
        }
      }
      if (end) {
        try {
          filter.timestamp.$lte = new Date(end)
        } catch (err) {
          console.error("Invalid end date:", end)
          return res.status(400).json({ error: "Invalid end date format" })
        }
      }
    }

    console.log("Final filter:", JSON.stringify(filter, null, 2))

    // Check how many documents match the filter
    const filteredCount = await collection.countDocuments(filter)
    console.log("Documents matching filter:", filteredCount)

    if (filteredCount === 0) {
      console.log("No documents match the filter")
      return res.json({})
    }

    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          // Handle timestamp conversion
          timestampDate: {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $type: "$timestamp" }, "date"] },
                  then: "$timestamp"
                },
                {
                  case: { $eq: [{ $type: "$timestamp" }, "string"] },
                  then: {
                    $dateFromString: { 
                      dateString: "$timestamp",
                      onError: new Date() // Fallback to current date if parsing fails
                    }
                  }
                }
              ],
              default: new Date() // Fallback for any other type
            }
          }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: "$timestampDate" },
            hour: { $hour: "$timestampDate" },
            intersection: "$intersection_id",
          },
          avgCongestion: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ["$intersection_congestion_level", "low"] }, then: 1 },
                  { case: { $eq: ["$intersection_congestion_level", "medium"] }, then: 2 },
                  { case: { $eq: ["$intersection_congestion_level", "high"] }, then: 3 },
                ],
                default: 0,
              },
            },
          },
          count: { $sum: 1 }
        },
      },
      { $sort: { "_id.day": 1, "_id.hour": 1 } },
    ]

    console.log("Executing congestion heatmap pipeline...")
    const data = await collection.aggregate(pipeline).toArray()
    console.log("Aggregation result count:", data.length)

    if (data.length === 0) {
      console.log("No aggregation results - check if intersection_congestion_level field exists")
      
      // Debug: Check if congestion level field exists
      const congestionFieldCheck = await collection.findOne({ 
        ...filter,
        intersection_congestion_level: { $exists: true } 
      })
      console.log("Congestion level field exists:", !!congestionFieldCheck)
      
      return res.json({})
    }

    // Transform data for heatmap visualization
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    // Group by intersection
    const intersectionMap = {}

    data.forEach((item) => {
      const intersection = item._id.intersection
      if (!intersectionMap[intersection]) {
        intersectionMap[intersection] = days.map((day) => {
          return {
            id: day,
            data: Array.from({ length: 24 }, (_, hour) => {
              return {
                x: hour.toString(),
                y: 0,
              }
            }),
          }
        })
      }

      const dayIndex = item._id.day - 1 // MongoDB dayOfWeek is 1-7 (Sunday-Saturday)
      const hour = item._id.hour

      if (dayIndex >= 0 && dayIndex < 7 && hour >= 0 && hour < 24) {
        intersectionMap[intersection][dayIndex].data[hour].y = item.avgCongestion
      }
    })

    console.log("Intersections in heatmap:", Object.keys(intersectionMap))
    console.log("=== CONGESTION HEATMAP SUCCESS ===")

    res.json(intersectionMap)
  } catch (error) {
    console.error("=== CONGESTION HEATMAP ERROR ===")
    console.error("Error details:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ 
      error: "Failed to fetch congestion heatmap data",
      details: error.message,
      collection: config.INTERSECTION_COLLECTION
    })
  }
})

// Debug endpoint to check intersection data structure and availability (NEW DEBUG ENDPOINT)
router.get("/:id/debug", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { id } = req.params

    console.log("=== INTERSECTION DEBUG ENDPOINT ===")
    console.log("Collection name:", config.INTERSECTION_COLLECTION)
    console.log("Intersection ID:", id)

    // Check if any data exists for this intersection
    const totalCount = await collection.countDocuments({ intersection_id: id })
    console.log("Total documents for intersection:", totalCount)

    if (totalCount === 0) {
      // Check what intersection IDs are available
      const availableIntersections = await collection.distinct("intersection_id")
      console.log("Available intersection IDs:", availableIntersections)

      return res.json({
        status: "No data found",
        intersection_id: id,
        total_documents: totalCount,
        available_intersections: availableIntersections,
        suggestion: availableIntersections.length > 0 
          ? `Try one of these intersection IDs: ${availableIntersections.join(", ")}`
          : "No intersection data available in the database"
      })
    }

    // Get a sample document to check structure
    const sampleDoc = await collection.findOne({ intersection_id: id })
    console.log("Sample document keys:", Object.keys(sampleDoc))

    // Check for different weather field types
    const coordWeatherCount = await collection.countDocuments({ 
      intersection_id: id, 
      coordinated_weather: { $exists: true } 
    })
    
    const localWeatherCount = await collection.countDocuments({ 
      intersection_id: id, 
      local_weather_conditions: { $exists: true } 
    })

    const fogDetectedCount = await collection.countDocuments({ 
      intersection_id: id, 
      fog_or_smoke_detected: { $exists: true } 
    })

    // Get latest records for each weather type
    const latestWithCoordWeather = coordWeatherCount > 0 
      ? await collection.findOne({ 
          intersection_id: id, 
          coordinated_weather: { $exists: true } 
        }, { sort: { timestamp: -1 } })
      : null

    const latestWithLocalWeather = localWeatherCount > 0
      ? await collection.findOne({ 
          intersection_id: id, 
          local_weather_conditions: { $exists: true } 
        }, { sort: { timestamp: -1 } })
      : null

    res.json({
      status: "Debug information",
      intersection_id: id,
      total_documents: totalCount,
      weather_field_analysis: {
        coordinated_weather: {
          count: coordWeatherCount,
          available: coordWeatherCount > 0,
          sample: latestWithCoordWeather?.coordinated_weather || null
        },
        local_weather_conditions: {
          count: localWeatherCount,
          available: localWeatherCount > 0,
          sample: latestWithLocalWeather?.local_weather_conditions || null
        },
        fog_or_smoke_detected: {
          count: fogDetectedCount,
          available: fogDetectedCount > 0
        }
      },
      sample_document_structure: {
        all_fields: Object.keys(sampleDoc),
        weather_related_fields: Object.keys(sampleDoc).filter(key => 
          key.toLowerCase().includes('weather') || 
          key.toLowerCase().includes('fog') ||
          key.toLowerCase().includes('visibility') ||
          key.toLowerCase().includes('temperature') ||
          key.toLowerCase().includes('humidity') ||
          key.toLowerCase().includes('wind')
        ),
        timestamp: sampleDoc.timestamp,
        sensor_id: sampleDoc.sensor_id
      },
      recommendations: {
        weather_sync_endpoint: coordWeatherCount > 0 
          ? "Enhanced coordinated_weather data available"
          : localWeatherCount > 0 
          ? "Basic local_weather_conditions available"
          : "No weather data available",
        suggested_action: coordWeatherCount === 0 && localWeatherCount === 0
          ? "Check if Kafka consumers are running and producing weather data"
          : "Weather synchronization endpoint should work with current data"
      }
    })
  } catch (error) {
    console.error("Debug endpoint error:", error)
    res.status(500).json({
      error: "Debug endpoint failed",
      details: error.message,
      intersection_id: id
    })
  }
})

// Stream intersection data in real-time
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const streamService = StreamService.getInstance()
  streamService.addClient("INTERSECTION", res)
})

module.exports = router

