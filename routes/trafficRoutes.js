const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const { calculateRiskScore, calculateRiskScoreV1, identifyRiskFactors } = require("../utils/riskAnalysis")
const config = require("../config/config")

// Enhanced Historical Traffic Data Endpoint with Intersection Coordination Support
router.get("/", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { 
      page = 1, 
      limit = 50, 
      sensor_id, 
      location_id, 
      intersection_id,    // NEW: Filter by intersection
      sensor_direction,   // NEW: Filter by sensor direction (north/south/east/west)
      enhanced_only,      // NEW: Only return data with intersection coordination fields
      start, 
      end 
    } = req.query

    console.log("=== ENHANCED TRAFFIC DATA REQUEST ===")
    console.log("Query parameters:", { 
      page, limit, sensor_id, location_id, intersection_id, sensor_direction, enhanced_only, start, end 
    })

    const filter = {}

    // Enhanced filtering for intersection coordination
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    // NEW: Filter by sensor direction for intersection coordination
    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by location ID if provided
    if (location_id) {
      filter.location_id = location_id
    }

    // NEW: Filter for enhanced data only (data with intersection coordination fields)
    if (enhanced_only === 'true') {
      filter.$and = [
        { intersection_id: { $exists: true, $ne: null } },
        { sensor_direction: { $exists: true, $ne: null } }
      ]
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

    console.log("MongoDB filter:", JSON.stringify(filter, null, 2))

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    // Enhanced projection to include new intersection coordination fields
    const data = await collection
      .find(filter)
      .project({
        // Original fields
        timestamp: 1,
        sensor_id: 1,
        location_id: 1,
        location_x: 1,
        location_y: 1,
        density: 1,
        speed: 1,
        travel_time: 1,
        vehicle_number: 1,
        vehicle_type_distribution: 1,
        weather_conditions: 1,
        local_weather_conditions: 1,
        // NEW: Enhanced intersection coordination fields
        intersection_id: 1,
        sensor_direction: 1,
        coordinated_weather: 1,
        traffic_light_phase: 1,
        vehicle_flow_rate: 1,
        queue_propagation_factor: 1,
        // Include schema version for compatibility tracking
        schema_version: 1,
        _enhanced: 1
      })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .toArray()

    const total = await collection.countDocuments(filter)

    // Analyze enhanced vs legacy data
    const enhancedCount = data.filter(item => 
      item.intersection_id && item.sensor_direction
    ).length

    const legacyCount = data.length - enhancedCount

    console.log(`Data analysis: ${enhancedCount} enhanced, ${legacyCount} legacy records`)

    res.json({
      data,
      pagination: {
        total,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
      // NEW: Enhanced data analysis
      enhancement_status: {
        enhanced_records: enhancedCount,
        legacy_records: legacyCount,
        enhancement_percentage: total > 0 ? Math.round((enhancedCount / data.length) * 100) : 0,
        intersection_coordination_available: enhancedCount > 0
      },
      // NEW: Unique intersections and sensor directions in result set
      intersection_summary: {
        unique_intersections: [...new Set(data.filter(d => d.intersection_id).map(d => d.intersection_id))],
        unique_sensor_directions: [...new Set(data.filter(d => d.sensor_direction).map(d => d.sensor_direction))],
        coordinated_weather_available: data.some(d => d.coordinated_weather)
      }
    })
  } catch (error) {
    console.error("Enhanced Traffic Data Error:", error)
    res.status(500).json({ error: "Failed to fetch enhanced traffic data" })
  }
})


// NEW: Weather Synchronization Endpoint
router.get("/intersection/:intersectionId/weather-sync", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { intersectionId } = req.params
    const { history_hours = 6 } = req.query

    const hoursAgo = new Date(Date.now() - history_hours * 60 * 60 * 1000)

    // Get weather synchronization data across all sensors
    const weatherData = await collection
      .find({
        intersection_id: intersectionId,
        timestamp: { $gte: hoursAgo },
        coordinated_weather: { $exists: true, $ne: null }
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray()

    if (weatherData.length === 0) {
      return res.status(404).json({
        error: "No weather synchronization data found",
        intersection_id: intersectionId,
        suggestion: "Ensure enhanced Rust simulator with weather coordination is running"
      })
    }

    // Analyze weather consistency across sensors
    const currentWeather = weatherData[0].coordinated_weather
    const weatherHistory = weatherData.map(d => ({
      timestamp: d.timestamp,
      sensor_id: d.sensor_id,
      sensor_direction: d.sensor_direction,
      weather_state: d.coordinated_weather
    }))

    // Check for weather synchronization issues
    const latestWeatherBySensor = {}
    weatherData.slice(0, 4).forEach(d => { // Latest from each sensor
      if (!latestWeatherBySensor[d.sensor_direction]) {
        latestWeatherBySensor[d.sensor_direction] = d.coordinated_weather
      }
    })

    const weatherConsistency = Object.values(latestWeatherBySensor)
    const isWeatherSynced = weatherConsistency.every(weather => 
      JSON.stringify(weather) === JSON.stringify(currentWeather)
    )

    res.json({
      intersection_id: intersectionId,
      current_weather: currentWeather,
      weather_synchronization: {
        synchronized: isWeatherSynced,
        active_sensors: Object.keys(latestWeatherBySensor).length,
        weather_by_sensor: latestWeatherBySensor,
        consistency_check: isWeatherSynced ? "all_sensors_synchronized" : "synchronization_mismatch"
      },
      weather_history: weatherHistory,
      sync_radius_meters: 500, // From your configuration
      data_period_hours: history_hours,
      last_update: weatherData[0].timestamp
    })
  } catch (error) {
    console.error("Weather Sync Error:", error)
    res.status(500).json({ error: "Failed to fetch weather synchronization data" })
  }
})

// NEW: Traffic Flow Tracking by Intersection
router.get("/intersection/:intersectionId/flow", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { intersectionId } = req.params
    const { hours = 2, granularity = "15min" } = req.query

    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Determine time grouping based on granularity
    let timeGrouping
    switch (granularity) {
      case "5min":
        timeGrouping = { 
          $dateToString: { 
            format: "%Y-%m-%d %H:%M", 
            date: { 
              $dateTrunc: { 
                date: "$timestamp", 
                unit: "minute", 
                binSize: 5 
              } 
            } 
          } 
        }
        break
      case "15min":
        timeGrouping = { 
          $dateToString: { 
            format: "%Y-%m-%d %H:%M", 
            date: { 
              $dateTrunc: { 
                date: "$timestamp", 
                unit: "minute", 
                binSize: 15 
              } 
            } 
          } 
        }
        break
      case "hour":
        timeGrouping = { 
          $dateToString: { 
            format: "%Y-%m-%d %H:00", 
            date: { 
              $dateTrunc: { 
                date: "$timestamp", 
                unit: "hour" 
              } 
            } 
          } 
        }
        break
      default:
        timeGrouping = { $hour: "$timestamp" }
    }

    const pipeline = [
      {
        $match: {
          intersection_id: intersectionId,
          timestamp: { $gte: hoursAgo },
          vehicle_flow_rate: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            time_bucket: timeGrouping,
            sensor_direction: "$sensor_direction"
          },
          avg_flow_rate: { $avg: "$vehicle_flow_rate" },
          max_flow_rate: { $max: "$vehicle_flow_rate" },
          avg_density: { $avg: "$density" },
          avg_speed: { $avg: "$speed" },
          avg_queue_propagation: { $avg: "$queue_propagation_factor" },
          data_points: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.time_bucket",
          total_flow_rate: { $sum: "$avg_flow_rate" },
          flow_by_direction: {
            $push: {
              direction: "$_id.sensor_direction",
              flow_rate: "$avg_flow_rate",
              max_flow: "$max_flow_rate",
              density: "$avg_density",
              speed: "$avg_speed",
              queue_factor: "$avg_queue_propagation"
            }
          },
          total_data_points: { $sum: "$data_points" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]

    const flowData = await collection.aggregate(pipeline).toArray()

    if (flowData.length === 0) {
      return res.status(404).json({
        error: "No flow tracking data found",
        intersection_id: intersectionId,
        suggestion: "Ensure enhanced Rust simulator with flow tracking is running"
      })
    }

    // Calculate flow trends and patterns
    const flowTrends = flowData.map(item => ({
      time_bucket: item._id,
      total_flow_rate: Math.round(item.total_flow_rate * 100) / 100,
      flow_by_direction: item.flow_by_direction.map(dir => ({
        ...dir,
        flow_rate: Math.round(dir.flow_rate * 100) / 100,
        density: Math.round(dir.density * 100) / 100,
        speed: Math.round(dir.speed * 100) / 100
      })),
      data_quality: item.total_data_points
    }))

    // Calculate peak flow periods
    const peakFlow = Math.max(...flowData.map(d => d.total_flow_rate))
    const peakFlowPeriod = flowData.find(d => d.total_flow_rate === peakFlow)

    res.json({
      intersection_id: intersectionId,
      flow_analysis: {
        time_period_hours: hours,
        granularity: granularity,
        total_time_buckets: flowData.length,
        peak_flow_rate: Math.round(peakFlow * 100) / 100,
        peak_flow_period: peakFlowPeriod?._id || null
      },
      flow_trends: flowTrends,
      flow_patterns: {
        directions_tracked: [...new Set(flowData.flatMap(d => d.flow_by_direction.map(dir => dir.direction)))],
        average_intersection_flow: Math.round((flowData.reduce((sum, d) => sum + d.total_flow_rate, 0) / flowData.length) * 100) / 100,
        flow_consistency: flowData.length > 1 ? "data_available" : "insufficient_data"
      }
    })
  } catch (error) {
    console.error("Flow Tracking Error:", error)
    res.status(500).json({ error: "Failed to fetch traffic flow data" })
  }
})

// Enhanced Traffic Density vs Speed with Intersection Coordination
router.get("/density-speed", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { start, end, sensor_id, intersection_id, sensor_direction } = req.query

    const filter = {}

    // Enhanced filtering
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by time range
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        filter.timestamp.$gte = new Date(start)
      }
      if (end) {
        filter.timestamp.$lte = new Date(end)
      }
    }

    const data = await collection
      .find(filter)
      .project({
        timestamp: 1,
        density: 1,
        speed: 1,
        sensor_id: 1,
        location_id: 1,
        // NEW: Include intersection coordination fields
        intersection_id: 1,
        sensor_direction: 1,
        vehicle_flow_rate: 1,
        traffic_light_phase: 1,
        coordinated_weather: 1
      })
      .sort({ timestamp: 1 })
      .toArray()

    const formattedData = data.map((item) => ({
      timestamp: item.timestamp,
      density: item.density,
      speed: item.speed,
      sensor_id: item.sensor_id,
      location_id: item.location_id,
      // NEW: Enhanced fields
      intersection_id: item.intersection_id || null,
      sensor_direction: item.sensor_direction || null,
      vehicle_flow_rate: item.vehicle_flow_rate || null,
      traffic_light_phase: item.traffic_light_phase || null,
      weather_conditions: item.coordinated_weather?.conditions || item.weather_conditions || null,
      enhanced: !!(item.intersection_id && item.sensor_direction)
    }))

    // NEW: Data enhancement analysis
    const enhancedData = formattedData.filter(item => item.enhanced)
    const enhancementRate = data.length > 0 ? (enhancedData.length / data.length) * 100 : 0

    res.json({
      data: formattedData,
      // NEW: Enhancement metadata
      enhancement_summary: {
        total_records: data.length,
        enhanced_records: enhancedData.length,
        enhancement_percentage: Math.round(enhancementRate * 100) / 100,
        unique_intersections: [...new Set(enhancedData.map(d => d.intersection_id).filter(Boolean))],
        sensor_directions_covered: [...new Set(enhancedData.map(d => d.sensor_direction).filter(Boolean))]
      }
    })
  } catch (error) {
    console.error("Enhanced Density-Speed Error:", error)
    res.status(500).json({ error: "Failed to fetch enhanced traffic density and speed data" })
  }
})

// Enhanced Weather Impact with Coordinated Weather Support
router.get("/weather-impact", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { intersection_id, use_coordinated = "true" } = req.query

    const filter = {}
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    // NEW: Use coordinated weather when available, fall back to local weather
    const weatherField = use_coordinated === "true" 
      ? "$coordinated_weather.conditions" 
      : "$weather_conditions"

    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          weather_source: {
            $cond: {
              if: { $ne: ["$coordinated_weather", null] },
              then: "$coordinated_weather.conditions",
              else: "$weather_conditions"
            }
          }
        }
      },
      {
        $group: {
          _id: "$weather_source",
          avgDensity: { $avg: "$density" },
          avgSpeed: { $avg: "$speed" },
          avgFlowRate: { $avg: "$vehicle_flow_rate" }, // NEW: Include flow rate
          count: { $sum: 1 },
          // NEW: Weather impact on coordination
          coordinated_records: {
            $sum: {
              $cond: [{ $ne: ["$coordinated_weather", null] }, 1, 0]
            }
          }
        },
      },
      { $sort: { count: -1 } },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    // NEW: Enhanced weather impact analysis
    const weatherAnalysis = data.map(item => ({
      weather_condition: item._id,
      avg_density: Math.round(item.avgDensity * 100) / 100,
      avg_speed: Math.round(item.avgSpeed * 100) / 100,
      avg_flow_rate: item.avgFlowRate ? Math.round(item.avgFlowRate * 100) / 100 : null,
      record_count: item.count,
      coordinated_percentage: Math.round((item.coordinated_records / item.count) * 100),
      // NEW: Weather severity impact classification
      impact_level: classifyWeatherImpact(item._id, item.avgSpeed, item.avgDensity)
    }))

    res.json({
      weather_impact_analysis: weatherAnalysis,
      analysis_metadata: {
        total_weather_conditions: data.length,
        intersection_filtered: !!intersection_id,
        coordinated_weather_prioritized: use_coordinated === "true",
        flow_rate_data_available: data.some(d => d.avgFlowRate !== null)
      }
    })
  } catch (error) {
    console.error("Enhanced Weather Impact Error:", error)
    res.status(500).json({ error: "Failed to fetch enhanced weather impact data" })
  }
})

// Enhanced Vehicle Distribution with Flow Integration
router.get("/vehicle-distribution", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { start, end, sensor_id, intersection_id, sensor_direction } = req.query

    const filter = {}

    // Enhanced filtering
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by time range
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        filter.timestamp.$gte = new Date(start)
      }
      if (end) {
        filter.timestamp.$lte = new Date(end)
      }
    }

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCars: { $sum: "$vehicle_type_distribution.cars" },
          totalBuses: { $sum: "$vehicle_type_distribution.buses" },
          totalMotorcycles: { $sum: "$vehicle_type_distribution.motorcycles" },
          totalTrucks: { $sum: "$vehicle_type_distribution.trucks" },
          // NEW: Flow rate impact by vehicle type
          avgFlowRate: { $avg: "$vehicle_flow_rate" },
          enhancedRecords: {
            $sum: {
              $cond: [{ $ne: ["$intersection_id", null] }, 1, 0]
            }
          },
          totalRecords: { $sum: 1 }
        },
      },
    ]

    const result = await collection.aggregate(pipeline).toArray()

    if (result.length > 0) {
      const data = result[0]
      delete data._id

      // Format for pie chart with enhancement data
      const formattedData = [
        { name: "Cars", value: data.totalCars },
        { name: "Buses", value: data.totalBuses },
        { name: "Motorcycles", value: data.totalMotorcycles },
        { name: "Trucks", value: data.totalTrucks },
      ]

      // NEW: Calculate vehicle mix impact on flow
      const totalVehicles = data.totalCars + data.totalBuses + data.totalMotorcycles + data.totalTrucks
      const vehicleMixAnalysis = {
        total_vehicles: totalVehicles,
        car_percentage: totalVehicles > 0 ? Math.round((data.totalCars / totalVehicles) * 100) : 0,
        heavy_vehicle_percentage: totalVehicles > 0 ? Math.round(((data.totalBuses + data.totalTrucks) / totalVehicles) * 100) : 0,
        average_flow_rate: data.avgFlowRate ? Math.round(data.avgFlowRate * 100) / 100 : null,
        flow_efficiency: calculateFlowEfficiency(data, totalVehicles)
      }

      res.json({
        vehicle_distribution: formattedData,
        vehicle_mix_analysis: vehicleMixAnalysis,
        data_enhancement: {
          enhanced_records: data.enhancedRecords,
          total_records: data.totalRecords,
          enhancement_percentage: Math.round((data.enhancedRecords / data.totalRecords) * 100)
        }
      })
    } else {
      res.json({
        vehicle_distribution: [],
        vehicle_mix_analysis: null,
        data_enhancement: { enhanced_records: 0, total_records: 0, enhancement_percentage: 0 }
      })
    }
  } catch (error) {
    console.error("Enhanced Vehicle Distribution Error:", error)
    res.status(500).json({ error: "Failed to fetch enhanced vehicle distribution data" })
  }
})

// Enhanced Traffic Congestion by Time with Intersection Coordination
router.get("/congestion-time", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { start, end, sensor_id, intersection_id, sensor_direction } = req.query

    const filter = {}

    // Enhanced filtering
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by time range
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        filter.timestamp.$gte = new Date(start)
      }
      if (end) {
        filter.timestamp.$lte = new Date(end)
      }
    }

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          avgDensity: { $avg: "$density" },
          avgSpeed: { $avg: "$speed" },
          avgFlowRate: { $avg: "$vehicle_flow_rate" }, // NEW
          avgQueuePropagation: { $avg: "$queue_propagation_factor" }, // NEW
          count: { $sum: 1 },
          // NEW: Traffic light phase distribution
          lightPhaseDistribution: {
            $push: "$traffic_light_phase"
          },
          enhancedRecords: {
            $sum: {
              $cond: [{ $ne: ["$intersection_id", null] }, 1, 0]
            }
          }
        },
      },
      { $sort: { _id: 1 } },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    const formattedData = data.map((item) => ({
      hour: item._id,
      avgDensity: Math.round(item.avgDensity * 100) / 100,
      avgSpeed: Math.round(item.avgSpeed * 100) / 100,
      count: item.count,
      // NEW: Enhanced coordination metrics
      avgFlowRate: item.avgFlowRate ? Math.round(item.avgFlowRate * 100) / 100 : null,
      avgQueuePropagation: item.avgQueuePropagation ? Math.round(item.avgQueuePropagation * 100) / 100 : null,
      enhancement_percentage: Math.round((item.enhancedRecords / item.count) * 100),
      // NEW: Traffic light coordination analysis
      light_phase_analysis: analyzeLightPhases(item.lightPhaseDistribution.filter(p => p))
    }))

    res.json({
      congestion_by_time: formattedData,
      coordination_summary: {
        intersection_filtered: !!intersection_id,
        sensor_direction_filtered: !!sensor_direction,
        flow_data_available: formattedData.some(d => d.avgFlowRate !== null),
        coordination_data_available: formattedData.some(d => d.enhancement_percentage > 0)
      }
    })
  } catch (error) {
    console.error("Enhanced Congestion Time Error:", error)
    res.status(500).json({ error: "Failed to fetch enhanced congestion by time data" })
  }
})

// Real-Time Traffic Data Streaming with Enhanced Features
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  const streamService = StreamService.getInstance()
  streamService.addClient("TRAFFIC", res)
  
  // Send initial connection confirmation with enhanced features info
  res.write(`data: ${JSON.stringify({
    type: "connection",
    message: "Enhanced traffic stream connected",
    features: [
      "intersection_coordination",
      "weather_synchronization", 
      "traffic_flow_tracking",
      "sensor_direction_filtering",
      "backwards_compatibility"
    ],
    timestamp: new Date().toISOString()
  })}\n\n`)
})

// NEW: Intersection-specific streaming endpoint
router.get("/intersection/:intersectionId/stream", (req, res) => {
  const { intersectionId } = req.params
  
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  const streamService = StreamService.getInstance()
  
  // Add client with intersection-specific filtering
  const originalAddClient = streamService.addClient.bind(streamService)
  streamService.addClient("TRAFFIC", res)
  
  // Override broadcast for this client to filter by intersection
  const originalWrite = res.write.bind(res)
  res.write = (data) => {
    try {
      const parsed = JSON.parse(data.replace('data: ', '').replace('\n\n', ''))
      if (parsed.data && parsed.data.intersection_id === intersectionId) {
        originalWrite(data)
      } else if (parsed.type === "connection") {
        originalWrite(data) // Always send connection messages
      }
    } catch (error) {
      originalWrite(data) // Send as-is if parsing fails
    }
  }
  
  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: "connection",
    intersection_id: intersectionId,
    message: "Intersection-specific stream connected",
    features: ["intersection_filtering", "coordination_updates"],
    timestamp: new Date().toISOString()
  })}\n\n`)
})

// Helper Functions for Enhanced Analytics

/**
 * Classify weather impact severity based on conditions and traffic metrics
 */
function classifyWeatherImpact(condition, avgSpeed, avgDensity) {
  if (!condition) return "unknown"
  
  const conditionLower = condition.toLowerCase()
  const speedReduction = avgSpeed < 30 // Assume 30+ is normal speed
  const highDensity = avgDensity > 70 // Assume 70%+ is high density
  
  if (conditionLower.includes('snow') || conditionLower.includes('ice')) {
    return speedReduction && highDensity ? "severe" : "high"
  } else if (conditionLower.includes('rain') || conditionLower.includes('fog')) {
    return speedReduction ? "moderate" : "low"
  } else if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
    return "minimal"
  }
  
  return "moderate"
}

/**
 * Calculate flow efficiency based on vehicle mix and flow rate
 */
function calculateFlowEfficiency(data, totalVehicles) {
  if (!data.avgFlowRate || totalVehicles === 0) return null
  
  // Heavy vehicles (buses + trucks) reduce flow efficiency
  const heavyVehicleRatio = (data.totalBuses + data.totalTrucks) / totalVehicles
  const baseEfficiency = Math.min(data.avgFlowRate / 60, 1.0) // Normalize to 0-1 (60 vehicles/min = optimal)
  const heavyVehiclePenalty = heavyVehicleRatio * 0.2 // Up to 20% penalty
  
  return Math.max(0, Math.round((baseEfficiency - heavyVehiclePenalty) * 100) / 100)
}

/**
 * Analyze traffic light phase distribution
 */
function analyzeLightPhases(lightPhases) {
  if (lightPhases.length === 0) return null
  
  const phaseCounts = lightPhases.reduce((acc, phase) => {
    acc[phase] = (acc[phase] || 0) + 1
    return acc
  }, {})
  
  const totalPhases = lightPhases.length
  const phaseDistribution = Object.entries(phaseCounts).map(([phase, count]) => ({
    phase,
    count,
    percentage: Math.round((count / totalPhases) * 100)
  }))
  
  return {
    total_observations: totalPhases,
    unique_phases: Object.keys(phaseCounts).length,
    phase_distribution: phaseDistribution,
    dominant_phase: phaseDistribution.reduce((max, current) => 
      current.count > max.count ? current : max
    )
  }
}

module.exports = router

