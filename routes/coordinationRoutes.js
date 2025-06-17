const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Get intersection coordination status with real-time data
router.get("/intersections/:intersectionId/status", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { intersectionId } = req.params
    const { hours = 1 } = req.query

    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000)
    const collection = await db.getCollection(config.COLLECTION_NAME)

    // Get latest enhanced data from all 4 sensors for this intersection
    // Use intersection_id instead of _enhanced flag for detection
    const pipeline = [
      {
        $match: {
          intersection_id: intersectionId,
          // TEMPORARILY REMOVE TIME FILTER to see historical coordination data
          // timestamp: { $gte: hoursAgo },
          // Use alternative enhanced detection: presence of intersection_id means enhanced
          $or: [
            { sensor_direction: { $exists: true, $ne: null } },
            { coordinated_weather: { $exists: true, $ne: null } },
            { vehicle_flow_rate: { $exists: true, $ne: null } }
          ]
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

    const sensorData = await collection.aggregate(pipeline).toArray()

    if (sensorData.length === 0) {
      // Check if intersection exists with ANY data (enhanced or legacy)
      const anyIntersectionData = await collection.find({ intersection_id: intersectionId }).limit(5).toArray()
      
      if (anyIntersectionData.length === 0) {
        // Get available intersections
        const availableIntersections = await collection.distinct("intersection_id")
        
        return res.status(404).json({
          error: "Intersection not found",
          intersection_id: intersectionId,
          available_intersections: availableIntersections,
          suggestion: "Check intersection ID or ensure enhanced Rust simulator is running"
        })
      } else {
        // Check if we have enhanced data but just not recent
        const enhancedData = await collection.find({ 
          intersection_id: intersectionId,
          $or: [
            { sensor_direction: { $exists: true, $ne: null } },
            { coordinated_weather: { $exists: true, $ne: null } },
            { vehicle_flow_rate: { $exists: true, $ne: null } }
          ]
        }).limit(5).toArray()
        
        if (enhancedData.length > 0) {
          return res.json({
            intersection_id: intersectionId,
            coordination_status: "enhanced_but_stale",
            message: "Enhanced intersection data exists but not recent",
            enhanced_data_count: enhancedData.length,
            latest_enhanced_timestamp: enhancedData[0]?.timestamp,
            recommendation: "Enhanced data found but may be older than requested time window"
          })
        } else {
          return res.json({
            intersection_id: intersectionId,
            coordination_status: "legacy_mode",
            message: "Intersection exists but no coordination data available",
            legacy_data_count: anyIntersectionData.length,
            upgrade_needed: "Enhanced Rust simulator with intersection coordination required"
          })
        }
      }
    }

    // Build coordination summary from enhanced data
    const coordinationSummary = {
      intersection_id: intersectionId,
      coordination_status: "active_historical", // Indicate this is historical data
      active_sensors: sensorData.length,
      sensors_by_direction: {},
      shared_weather: null,
      traffic_light_coordination: {},
      flow_metrics: {},
      efficiency_metrics: {},
      last_update: Math.max(...sensorData.map(d => new Date(d.timestamp).getTime())),
      data_note: "Showing historical coordination data - simulator may not be currently running"
    }

    // Process each sensor direction
    sensorData.forEach(sensor => {
      const direction = sensor.sensor_direction || 'unknown'
      
      coordinationSummary.sensors_by_direction[direction] = {
        sensor_id: sensor.sensor_id,
        density: sensor.density,
        speed: sensor.speed,
        vehicle_flow_rate: sensor.vehicle_flow_rate,
        traffic_light_phase: sensor.traffic_light_phase,
        queue_propagation_factor: sensor.queue_propagation_factor,
        timestamp: sensor.timestamp
      }

      // Shared weather (should be the same across all sensors)
      if (sensor.coordinated_weather && !coordinationSummary.shared_weather) {
        coordinationSummary.shared_weather = sensor.coordinated_weather
      }
    })

    // Calculate intersection-wide metrics
    const totalVehicleFlow = sensorData.reduce((sum, s) => sum + (s.vehicle_flow_rate || 0), 0)
    const avgDensity = sensorData.reduce((sum, s) => sum + (s.density || 0), 0) / sensorData.length
    const avgSpeed = sensorData.reduce((sum, s) => sum + (s.speed || 0), 0) / sensorData.length

    coordinationSummary.flow_metrics = {
      total_vehicle_flow_rate: Math.round(totalVehicleFlow * 100) / 100,
      average_density: Math.round(avgDensity * 100) / 100,
      average_speed: Math.round(avgSpeed * 100) / 100,
      intersection_utilization: Math.min(totalVehicleFlow / 120, 1.0) // Normalize to 0-1 (120 vehicles/min = max)
    }

    // Traffic light coordination analysis
    const lightPhases = sensorData.map(s => s.traffic_light_phase).filter(p => p)
    const uniquePhases = [...new Set(lightPhases)]
    
    coordinationSummary.traffic_light_coordination = {
      coordinated: lightPhases.length === sensorData.length, // All sensors have light data
      unique_phases: uniquePhases,
      synchronization_status: uniquePhases.length <= 2 ? "synchronized" : "unsynchronized"
    }

    res.json(coordinationSummary)
  } catch (error) {
    console.error("Intersection Coordination Error:", error)
    res.status(500).json({ error: "Failed to fetch intersection coordination data" })
  }
})

// Get weather synchronization data
router.get("/intersections/:intersectionId/weather", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { intersectionId } = req.params
    const { history_hours = 6 } = req.query

    const hoursAgo = new Date(Date.now() - history_hours * 60 * 60 * 1000)
    const collection = await db.getCollection(config.COLLECTION_NAME)

    // Get weather synchronization data across all sensors
    // Use alternative enhanced detection instead of _enhanced flag
    const weatherData = await collection
      .find({
        intersection_id: intersectionId,
        // REMOVE TIME FILTER TEMPORARILY to get historical data
        // timestamp: { $gte: hoursAgo },
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
      weather_state: d.coordinated_weather,
      temperature: d.coordinated_weather?.temperature,
      conditions: d.coordinated_weather?.conditions,
      road_condition: d.coordinated_weather?.road_condition
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

    // Calculate weather impact on traffic
    const weatherImpactAnalysis = {
      current_conditions: currentWeather?.conditions || "unknown",
      temperature_range: {
        min: Math.min(...weatherHistory.map(w => w.temperature || 0)),
        max: Math.max(...weatherHistory.map(w => w.temperature || 0)),
        current: currentWeather?.temperature || null
      },
      road_conditions: [...new Set(weatherHistory.map(w => w.road_condition).filter(Boolean))],
      visibility_impact: currentWeather?.visibility === "poor" ? "high" : 
                        currentWeather?.visibility === "fair" ? "moderate" : "low"
    }

    res.json({
      intersection_id: intersectionId,
      current_weather: currentWeather,
      weather_synchronization: {
        synchronized: isWeatherSynced,
        active_sensors: Object.keys(latestWeatherBySensor).length,
        weather_by_sensor: latestWeatherBySensor,
        consistency_check: isWeatherSynced ? "all_sensors_synchronized" : "synchronization_mismatch"
      },
      weather_impact_analysis: weatherImpactAnalysis,
      weather_history: weatherHistory,
      sync_radius_meters: 500,
      data_period_hours: history_hours,
      last_update: weatherData[0].timestamp
    })
  } catch (error) {
    console.error("Weather Sync Error:", error)
    res.status(500).json({ error: "Failed to fetch weather synchronization data" })
  }
})

// Get traffic light coordination data
router.get("/intersections/:intersectionId/lights", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { intersectionId } = req.params
    const { hours = 2 } = req.query


    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000)
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)

    // Get latest intersection coordination data
    // Use alternative enhanced detection instead of _enhanced flag
    const lightData = await collection
      .find({
        intersection_id: intersectionId,
        // REMOVE TIME FILTER TEMPORARILY to get historical data
        // timestamp: { $gte: hoursAgo },
        coordinated_light_status: { $exists: true, $ne: null }
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray()

    if (lightData.length === 0) {
      return res.status(404).json({
        error: "No traffic light coordination data found",
        intersection_id: intersectionId,
        suggestion: "Ensure enhanced Rust simulator with light coordination is running"
      })
    }

    const latestLight = lightData[0]
    
    // Calculate dynamic total vehicles based on actual flow data
    const collection_traffic = await db.getCollection(config.COLLECTION_NAME)
    const flowData = await collection_traffic.aggregate([
      {
        $match: {
          intersection_id: intersectionId,
          vehicle_flow_rate: { $exists: true, $ne: null },
          timestamp: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes
        }
      },
      {
        $group: {
          _id: "$sensor_direction",
          avg_flow_rate: { $avg: "$vehicle_flow_rate" },
          latest_timestamp: { $max: "$timestamp" }
        }
      }
    ]).toArray()

    // Calculate realistic total vehicles based on flow rates
    const totalFlowRate = flowData.reduce((sum, d) => sum + d.avg_flow_rate, 0)
    const dynamicTotalVehicles = Math.round(totalFlowRate * 0.5) || latestLight.total_intersection_vehicles || 40

    // Calculate realistic efficiency based on flow balance
    const flowRates = flowData.map(d => d.avg_flow_rate)
    const avgFlow = totalFlowRate / flowData.length
    const flowVariance = flowRates.length > 0 ? 
      Math.sqrt(flowRates.reduce((sum, rate) => sum + Math.pow(rate - avgFlow, 2), 0) / flowRates.length) : 0
    const dynamicEfficiency = flowData.length === 4 ? 
      Math.max(0.6, 1.0 - (flowVariance / 100)) : 
      (latestLight.intersection_efficiency || 0.8)

    
    // Analyze light phase patterns
    const phaseHistory = lightData.map(d => ({
      timestamp: d.timestamp,
      coordinated_light_status: d.coordinated_light_status,
      phase_time_remaining: d.phase_time_remaining,
      intersection_efficiency: dynamicEfficiency, // Use dynamic value
      total_vehicles: dynamicTotalVehicles // Use dynamic value
    }))

    // Calculate phase distribution
    const phaseDistribution = lightData.reduce((acc, d) => {
      const phase = d.coordinated_light_status
      acc[phase] = (acc[phase] || 0) + 1
      return acc
    }, {})

    // Calculate average efficiency by phase
    const efficiencyByPhase = {}
    Object.keys(phaseDistribution).forEach(phase => {
      const phaseData = lightData.filter(d => d.coordinated_light_status === phase)
      const avgEfficiency = phaseData.reduce((sum, d) => sum + (d.intersection_efficiency || 0), 0) / phaseData.length
      efficiencyByPhase[phase] = Math.round(avgEfficiency * 100) / 100
    })

    res.json({
      intersection_id: intersectionId,
      current_light_status: {
        coordinated_light_status: latestLight.coordinated_light_status,
        phase_time_remaining: latestLight.phase_time_remaining,
        intersection_efficiency: latestLight.intersection_efficiency,
        total_vehicles: latestLight.total_intersection_vehicles,
        timestamp: latestLight.timestamp
      },
      phase_analysis: {
        phase_distribution: phaseDistribution,
        efficiency_by_phase: efficiencyByPhase,
        most_efficient_phase: Object.entries(efficiencyByPhase)
          .reduce((max, [phase, eff]) => eff > max.efficiency ? {phase, efficiency: eff} : max, 
                  {phase: null, efficiency: 0})
      },
      phase_history: phaseHistory,
      coordination_metrics: {
        total_observations: lightData.length,
        average_efficiency: Math.round((lightData.reduce((sum, d) => sum + (d.intersection_efficiency || 0), 0) / lightData.length) * 100) / 100,
        peak_vehicles: Math.max(...lightData.map(d => d.total_intersection_vehicles || 0)),
        data_period_hours: hours
      },
      last_update: latestLight.timestamp
    })
  } catch (error) {
    console.error("Light Coordination Error:", error)
    res.status(500).json({ error: "Failed to fetch traffic light coordination data" })
  }
})

// Get traffic flow tracking for intersection
router.get("/intersections/:intersectionId/flow", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { intersectionId } = req.params
    const { hours = 2, granularity = "15min" } = req.query


    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000)
    const collection = await db.getCollection(config.COLLECTION_NAME)

    // Simplified pipeline without complex date operators
    const pipeline = [
      {
        $match: {
          intersection_id: intersectionId,
          // REMOVE TIME FILTER TEMPORARILY to get historical data
          // timestamp: { $gte: hoursAgo },
          vehicle_flow_rate: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$sensor_direction",
          avg_flow_rate: { $avg: "$vehicle_flow_rate" },
          max_flow_rate: { $max: "$vehicle_flow_rate" },
          min_flow_rate: { $min: "$vehicle_flow_rate" },
          avg_density: { $avg: "$density" },
          avg_speed: { $avg: "$speed" },
          avg_queue_propagation: { $avg: "$queue_propagation_factor" },
          data_points: { $sum: 1 },
          latest_timestamp: { $max: "$timestamp" },
          sensor_ids: { $addToSet: "$sensor_id" }
        }
      },
      {
        $sort: { avg_flow_rate: -1 }
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

    // Calculate intersection-wide metrics
    const totalFlowRate = flowData.reduce((sum, d) => sum + d.avg_flow_rate, 0)
    const totalDataPoints = flowData.reduce((sum, d) => sum + d.data_points, 0)

    // Format flow data by direction
    const flowByDirection = flowData.map(dir => ({
      direction: dir._id || 'unknown',
      avg_flow_rate: Math.round(dir.avg_flow_rate * 100) / 100,
      max_flow_rate: Math.round(dir.max_flow_rate * 100) / 100,
      min_flow_rate: Math.round(dir.min_flow_rate * 100) / 100,
      avg_density: Math.round(dir.avg_density * 100) / 100,
      avg_speed: Math.round(dir.avg_speed * 100) / 100,
      avg_queue_factor: dir.avg_queue_propagation ? Math.round(dir.avg_queue_propagation * 100) / 100 : null,
      data_points: dir.data_points,
      sensor_ids: dir.sensor_ids,
      latest_update: dir.latest_timestamp
    }))

    const peakDirection = flowByDirection.reduce((max, current) => 
      current.avg_flow_rate > max.avg_flow_rate ? current : max
    )

    res.json({
      intersection_id: intersectionId,
      flow_analysis: {
        total_flow_rate: Math.round(totalFlowRate * 100) / 100,
        total_data_points: totalDataPoints,
        directions_analyzed: flowData.length,
        data_period_note: "Historical data - time filtering temporarily disabled"
      },
      flow_by_direction: flowByDirection,
      flow_summary: {
        peak_direction: peakDirection.direction,
        peak_flow_rate: peakDirection.avg_flow_rate,
        average_intersection_flow: Math.round((totalFlowRate / flowData.length) * 100) / 100,
        intersection_utilization: Math.min(totalFlowRate / 480, 1.0), // 480 = 4 directions * 120 max
        flow_balance: {
          highest: peakDirection.avg_flow_rate,
          lowest: Math.min(...flowByDirection.map(d => d.avg_flow_rate)),
          variance: Math.round((Math.max(...flowByDirection.map(d => d.avg_flow_rate)) - 
                              Math.min(...flowByDirection.map(d => d.avg_flow_rate))) * 100) / 100
        }
      }
    })
  } catch (error) {
    console.error("Flow Tracking Error:", error)
    res.status(500).json({ error: "Failed to fetch traffic flow data" })
  }
})

// Get all intersections with coordination status
router.get("/intersections", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { status = "all", enhanced_only = "false" } = req.query


    const collection = await db.getCollection(config.COLLECTION_NAME)
    
    // Get all intersections with coordination data (remove time filter to see historical data)
    // const recentTime = new Date(Date.now() - 60 * 60 * 1000) // Last hour
    
    let matchStage = {
      intersection_id: { $exists: true, $ne: null }
      // Remove timestamp filter to show historical coordination data
      // timestamp: { $gte: recentTime }
    }

    if (enhanced_only === "true") {
      // Use alternative enhanced detection instead of _enhanced flag
      matchStage.$or = [
        { coordinated_weather: { $exists: true, $ne: null } },
        { vehicle_flow_rate: { $exists: true, $ne: null } },
        { sensor_direction: { $exists: true, $ne: null } }
      ]
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: "$intersection_id",
          sensor_count: { $sum: 1 },
          enhanced_sensors: {
            // Count sensors with enhanced features instead of _enhanced flag
            $sum: { 
              $cond: [
                { 
                  $or: [
                    { $ne: ["$coordinated_weather", null] },
                    { $ne: ["$vehicle_flow_rate", null] },
                    { $ne: ["$sensor_direction", null] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          },
          unique_directions: { $addToSet: "$sensor_direction" },
          avg_flow_rate: { $avg: "$vehicle_flow_rate" },
          latest_timestamp: { $max: "$timestamp" },
          weather_available: {
            $sum: { $cond: [{ $ne: ["$coordinated_weather", null] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          coordination_status: {
            $switch: {
              branches: [
                {
                  case: { $gte: ["$enhanced_sensors", 4] },
                  then: "full_coordination"
                },
                {
                  case: { $gt: ["$enhanced_sensors", 0] },
                  then: "partial_coordination"
                }
              ],
              default: "legacy_mode"
            }
          },
          sensor_coverage: {
            $round: [{ $multiply: [{ $divide: ["$enhanced_sensors", "$sensor_count"] }, 100] }, 0]
          }
        }
      },
      { $sort: { latest_timestamp: -1 } }
    ]

    if (status !== "all") {
      pipeline.splice(-1, 0, { $match: { coordination_status: status } })
    }

    const intersections = await collection.aggregate(pipeline).toArray()

    // Get summary statistics
    const totalIntersections = intersections.length
    const coordinationSummary = intersections.reduce((acc, intersection) => {
      acc[intersection.coordination_status] = (acc[intersection.coordination_status] || 0) + 1
      return acc
    }, {})


    res.json({
      total_intersections: totalIntersections,
      coordination_summary: coordinationSummary,
      intersections: intersections.map(intersection => ({
        intersection_id: intersection._id,
        coordination_status: intersection.coordination_status,
        sensor_count: intersection.sensor_count,
        enhanced_sensors: intersection.enhanced_sensors,
        sensor_coverage_percent: intersection.sensor_coverage,
        unique_directions: intersection.unique_directions.filter(Boolean),
        avg_flow_rate: intersection.avg_flow_rate ? Math.round(intersection.avg_flow_rate * 100) / 100 : null,
        weather_synchronized: intersection.weather_available > 0,
        last_update: intersection.latest_timestamp,
        health_status: intersection.enhanced_sensors >= 4 ? "optimal" : 
                      intersection.enhanced_sensors > 0 ? "degraded" : "legacy",
        data_note: "Historical coordination data - may not be real-time"
      }))
    })
  } catch (error) {
    console.error("All Intersections Coordination Error:", error)
    res.status(500).json({ error: "Failed to fetch intersections coordination data" })
  }
})

// Real-time coordination streaming endpoint
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  
  const streamService = StreamService.getInstance()
  streamService.addClient("COORDINATION", res)
  
  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: "connection",
    message: "Coordination stream connected",
    features: [
      "intersection_coordination",
      "weather_synchronization", 
      "traffic_light_coordination",
      "flow_tracking",
      "real_time_updates"
    ],
    timestamp: new Date().toISOString()
  })}\n\n`)
})

// Intersection-specific coordination streaming
router.get("/intersections/:intersectionId/stream", (req, res) => {
  const { intersectionId } = req.params
  
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  
  const streamService = StreamService.getInstance()
  streamService.addClient("COORDINATION", res)
  
  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: "connection",
    intersection_id: intersectionId,
    message: "Intersection-specific coordination stream connected",
    features: ["intersection_filtering", "coordination_updates", "weather_sync", "light_coordination"],
    timestamp: new Date().toISOString()
  })}\n\n`)
})

// Coordination diagnostics endpoint
router.get("/diagnostics", async (req, res) => {
  const db = Database.getInstance()
  try {

    const collection = await db.getCollection(config.COLLECTION_NAME)
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    
    // Check enhanced data availability
    const enhancedTrafficCount = await collection.countDocuments({ _enhanced: true })
    const totalTrafficCount = await collection.countDocuments({})
    const enhancedIntersectionCount = await intersectionCollection.countDocuments({ _enhanced: true })
    const totalIntersectionCount = await intersectionCollection.countDocuments({})
    
    // NEW: Check for schema_version field as alternative
    const schemaV2TrafficCount = await collection.countDocuments({ schema_version: "2.0" })
    const schemaV2IntersectionCount = await intersectionCollection.countDocuments({ schema_version: "2.0" })
    
    // NEW: Check for intersection_id field (enhanced data indicator)
    const intersectionIdTrafficCount = await collection.countDocuments({ intersection_id: { $exists: true, $ne: null } })
    const coordWeatherTrafficCount = await collection.countDocuments({ coordinated_weather: { $exists: true, $ne: null } })
    
    // Check recent data (last 5 minutes)
    const recentTime = new Date(Date.now() - 5 * 60 * 1000)
    const recentEnhancedData = await collection.countDocuments({ 
      _enhanced: true, 
      timestamp: { $gte: recentTime } 
    })
    
    // NEW: Check recent data with alternative fields
    const recentSchemaV2Data = await collection.countDocuments({ 
      schema_version: "2.0", 
      timestamp: { $gte: recentTime } 
    })
    
    const recentIntersectionData = await collection.countDocuments({ 
      intersection_id: { $exists: true, $ne: null }, 
      timestamp: { $gte: recentTime } 
    })
    
    // Check intersection coordination features
    const coordinationFeatures = await collection.aggregate([
      { $match: { _enhanced: true } },
      {
        $group: {
          _id: null,
          intersections_with_weather: { $sum: { $cond: [{ $ne: ["$coordinated_weather", null] }, 1, 0] } },
          intersections_with_flow: { $sum: { $cond: [{ $ne: ["$vehicle_flow_rate", null] }, 1, 0] } },
          intersections_with_directions: { $sum: { $cond: [{ $ne: ["$sensor_direction", null] }, 1, 0] } },
          total_enhanced: { $sum: 1 }
        }
      }
    ]).toArray()
    
    // NEW: Alternative coordination features check
    const altCoordinationFeatures = await collection.aggregate([
      { $match: { intersection_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          intersections_with_weather: { $sum: { $cond: [{ $ne: ["$coordinated_weather", null] }, 1, 0] } },
          intersections_with_flow: { $sum: { $cond: [{ $ne: ["$vehicle_flow_rate", null] }, 1, 0] } },
          intersections_with_directions: { $sum: { $cond: [{ $ne: ["$sensor_direction", null] }, 1, 0] } },
          total_enhanced: { $sum: 1 }
        }
      }
    ]).toArray()

    const features = coordinationFeatures[0] || {}
    const altFeatures = altCoordinationFeatures[0] || {}
    
    // NEW: Sample enhanced documents for debugging
    const sampleEnhancedTraffic = await collection.findOne({ intersection_id: { $exists: true, $ne: null } })
    const sampleEnhancedIntersection = await intersectionCollection.findOne({ intersection_id: { $exists: true, $ne: null } })

    res.json({
      system_status: "operational",
      debug_info: {
        collection_names: {
          traffic: config.COLLECTION_NAME,
          intersection: config.INTERSECTION_COLLECTION
        },
        sample_documents: {
          enhanced_traffic_sample: sampleEnhancedTraffic ? {
            has_intersection_id: !!sampleEnhancedTraffic.intersection_id,
            has_enhanced_flag: !!sampleEnhancedTraffic._enhanced,
            has_schema_version: !!sampleEnhancedTraffic.schema_version,
            has_coordinated_weather: !!sampleEnhancedTraffic.coordinated_weather,
            has_sensor_direction: !!sampleEnhancedTraffic.sensor_direction,
            timestamp: sampleEnhancedTraffic.timestamp
          } : null,
          enhanced_intersection_sample: sampleEnhancedIntersection ? {
            has_intersection_id: !!sampleEnhancedIntersection.intersection_id,
            has_enhanced_flag: !!sampleEnhancedIntersection._enhanced,
            has_schema_version: !!sampleEnhancedIntersection.schema_version,
            has_coordinated_light_status: !!sampleEnhancedIntersection.coordinated_light_status,
            timestamp: sampleEnhancedIntersection.timestamp
          } : null
        }
      },
      data_overview: {
        // Original checks
        total_traffic_records: totalTrafficCount,
        enhanced_traffic_records: enhancedTrafficCount,
        enhancement_percentage: totalTrafficCount > 0 ? Math.round((enhancedTrafficCount / totalTrafficCount) * 100) : 0,
        total_intersection_records: totalIntersectionCount,
        enhanced_intersection_records: enhancedIntersectionCount,
        
        // NEW: Alternative enhancement checks
        schema_v2_traffic_records: schemaV2TrafficCount,
        schema_v2_intersection_records: schemaV2IntersectionCount,
        intersection_id_traffic_records: intersectionIdTrafficCount,
        coordinated_weather_records: coordWeatherTrafficCount
      },
      real_time_status: {
        recent_enhanced_data: recentEnhancedData,
        recent_schema_v2_data: recentSchemaV2Data,
        recent_intersection_data: recentIntersectionData,
        data_freshness: (recentEnhancedData > 0 || recentSchemaV2Data > 0 || recentIntersectionData > 0) ? "current" : "stale",
        last_check: new Date().toISOString()
      },
      coordination_features: {
        // Original features
        weather_coordination_active: features.intersections_with_weather > 0,
        flow_tracking_active: features.intersections_with_flow > 0,
        sensor_direction_mapping: features.intersections_with_directions > 0,
        feature_coverage: {
          weather: features.intersections_with_weather || 0,
          flow: features.intersections_with_flow || 0,
          directions: features.intersections_with_directions || 0,
          total_enhanced: features.total_enhanced || 0
        },
        
        // NEW: Alternative features check
        alt_coordination_features: {
          weather_coordination_active: altFeatures.intersections_with_weather > 0,
          flow_tracking_active: altFeatures.intersections_with_flow > 0,
          sensor_direction_mapping: altFeatures.intersections_with_directions > 0,
          feature_coverage: {
            weather: altFeatures.intersections_with_weather || 0,
            flow: altFeatures.intersections_with_flow || 0,
            directions: altFeatures.intersections_with_directions || 0,
            total_enhanced: altFeatures.total_enhanced || 0
          }
        }
      },
      recommendations: [
        enhancedTrafficCount === 0 && intersectionIdTrafficCount === 0 ? "Enable enhanced Rust simulator with intersection coordination" : null,
        recentEnhancedData === 0 && recentIntersectionData === 0 ? "Check if enhanced consumers are running and receiving data" : null,
        features.intersections_with_weather === 0 && altFeatures.intersections_with_weather === 0 ? "Verify weather coordination is working" : null,
        enhancedTrafficCount === 0 && intersectionIdTrafficCount > 0 ? "Enhanced data detected but _enhanced flag missing - check consumer logic" : null
      ].filter(Boolean)
    })
  } catch (error) {
    console.error("Coordination Diagnostics Error:", error)
    res.status(500).json({ error: "Failed to fetch coordination diagnostics" })
  }
})

// Enhanced intersection status with dynamic vehicle calculation
router.get("/intersections/:intersectionId/status/enhanced", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { intersectionId } = req.params


    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)

    // Get latest traffic data from all 4 sensors for this intersection
    const latestTrafficData = await trafficCollection
      .find({
        intersection_id: intersectionId,
        sensor_direction: { $exists: true, $ne: null }
      })
      .sort({ timestamp: -1 })
      .limit(8) // 2 per direction max
      .toArray()

    // Get latest intersection coordination data
    const latestIntersectionData = await intersectionCollection
      .findOne(
        { intersection_id: intersectionId },
        { sort: { timestamp: -1 } }
      )

    if (latestTrafficData.length === 0 && !latestIntersectionData) {
      return res.status(404).json({
        error: "No enhanced data found for intersection",
        intersection_id: intersectionId,
        suggestion: "Check if enhanced Rust simulator is running"
      })
    }

    // Group traffic data by sensor direction (take latest per direction)
    const sensorsByDirection = {}
    latestTrafficData.forEach(data => {
      const direction = data.sensor_direction
      if (!sensorsByDirection[direction] || new Date(data.timestamp) > new Date(sensorsByDirection[direction].timestamp)) {
        sensorsByDirection[direction] = data
      }
    })

    // Calculate DYNAMIC vehicle count from actual sensor data
    const dynamicVehicleCount = Object.values(sensorsByDirection)
      .reduce((sum, sensor) => sum + (sensor.vehicle_number || 0), 0)

    // Calculate DYNAMIC flow rate
    const dynamicFlowRate = Object.values(sensorsByDirection)
      .reduce((sum, sensor) => sum + (sensor.vehicle_flow_rate || 0), 0)

    // Calculate DYNAMIC efficiency based on flow variance
    const flowRates = Object.values(sensorsByDirection).map(s => s.vehicle_flow_rate || 0)
    const avgFlow = flowRates.length > 0 ? flowRates.reduce((a, b) => a + b, 0) / flowRates.length : 0
    const flowVariance = flowRates.length > 0 ? 
      Math.sqrt(flowRates.reduce((sum, rate) => sum + Math.pow(rate - avgFlow, 2), 0) / flowRates.length) : 0
    const dynamicEfficiency = flowRates.length === 4 ? 
      Math.max(0.6, 1.0 - (flowVariance / 100)) : 0.8

    // Calculate weather coordination status
    const weatherStates = Object.values(sensorsByDirection)
      .map(s => s.coordinated_weather)
      .filter(w => w)
    
    const isWeatherSynced = weatherStates.length > 1 && 
      weatherStates.every(w => JSON.stringify(w) === JSON.stringify(weatherStates[0]))

    // Calculate light coordination
    const lightPhases = Object.values(sensorsByDirection)
      .map(s => s.traffic_light_phase)
      .filter(p => p)
    
    const uniqueLightPhases = [...new Set(lightPhases)]
    

    res.json({
      intersection_id: intersectionId,
      dynamic_calculation: {
        total_vehicles_dynamic: dynamicVehicleCount,
        total_vehicles_static: latestIntersectionData?.total_intersection_vehicles || null,
        vehicle_count_corrected: dynamicVehicleCount !== (latestIntersectionData?.total_intersection_vehicles || 0),
        flow_rate_dynamic: Math.round(dynamicFlowRate * 100) / 100,
        efficiency_dynamic: Math.round(dynamicEfficiency * 100) / 100,
        efficiency_static: latestIntersectionData?.intersection_efficiency || null
      },
      sensors_by_direction: Object.fromEntries(
        Object.entries(sensorsByDirection).map(([direction, sensor]) => [
          direction,
          {
            sensor_id: sensor.sensor_id,
            vehicle_number: sensor.vehicle_number,
            vehicle_flow_rate: sensor.vehicle_flow_rate,
            density: sensor.density,
            speed: sensor.speed,
            traffic_light_phase: sensor.traffic_light_phase,
            timestamp: sensor.timestamp
          }
        ])
      ),
      coordination_status: {
        active_sensors: Object.keys(sensorsByDirection).length,
        expected_sensors: 4,
        weather_synchronized: isWeatherSynced,
        light_phases_detected: uniqueLightPhases.length,
        light_coordination_status: uniqueLightPhases.length <= 2 ? "synchronized" : "unsynchronized"
      },
      weather_coordination: weatherStates.length > 0 ? {
        current_weather: weatherStates[0],
        synchronized_across_sensors: isWeatherSynced,
        sensors_reporting_weather: weatherStates.length
      } : null,
      intersection_coordination: latestIntersectionData ? {
        coordinated_light_status: latestIntersectionData.coordinated_light_status,
        phase_time_remaining: latestIntersectionData.phase_time_remaining,
        intersection_efficiency_static: latestIntersectionData.intersection_efficiency,
        timestamp: latestIntersectionData.timestamp
      } : null,
      data_freshness: {
        latest_traffic_update: latestTrafficData.length > 0 ? 
          Math.max(...latestTrafficData.map(d => new Date(d.timestamp).getTime())) : null,
        latest_intersection_update: latestIntersectionData ? 
          new Date(latestIntersectionData.timestamp).getTime() : null,
        calculation_timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Enhanced Dynamic Status Error:", error)
    res.status(500).json({ error: "Failed to fetch enhanced dynamic intersection status" })
  }
})

// Calculate dynamic flow rates based on actual traffic conditions
router.get("/intersections/:intersectionId/flow/dynamic", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { intersectionId } = req.params


    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)

    // Get latest traffic data from all sensors for this intersection
    const latestTrafficData = await trafficCollection
      .find({
        intersection_id: intersectionId,
        sensor_direction: { $exists: true, $ne: null }
      })
      .sort({ timestamp: -1 })
      .limit(8) // 2 per direction max
      .toArray()

    if (latestTrafficData.length === 0) {
      return res.status(404).json({
        error: "No traffic data found for intersection",
        intersection_id: intersectionId
      })
    }

    // Group by sensor direction (take latest per direction)
    const sensorsByDirection = {}
    latestTrafficData.forEach(data => {
      const direction = data.sensor_direction
      if (!sensorsByDirection[direction] || new Date(data.timestamp) > new Date(sensorsByDirection[direction].timestamp)) {
        sensorsByDirection[direction] = data
      }
    })

    // Calculate DYNAMIC flow rates for each sensor
    const flowCalculations = Object.entries(sensorsByDirection).map(([direction, sensor]) => {
      // Real flow rate calculation based on actual traffic conditions
      const vehicleCount = sensor.vehicle_number || 0
      const density = sensor.density || 0 // percentage
      const speed = sensor.speed || 0 // km/h
      const staticFlowRate = sensor.vehicle_flow_rate || 0

      // Dynamic flow rate calculation methods:

      // Method 1: Based on vehicle count and average processing time
      const avgProcessingTimeMin = 0.5 // Assume 30 seconds per vehicle on average
      const flowRateMethod1 = vehicleCount / avgProcessingTimeMin

      // Method 2: Based on density and speed (more realistic)
      // Higher density = more vehicles but slower flow
      // Higher speed = faster flow
      const densityFactor = Math.max(0.1, (100 - density) / 100) // Lower density = better flow
      const speedFactor = Math.max(0.1, speed / 80) // Normalize speed (80 km/h = optimal)
      const flowRateMethod2 = vehicleCount * densityFactor * speedFactor * 2 // Scale factor

      // Method 3: Traffic engineering formula approximation
      // Flow = (Density * Speed) / Vehicle Length, adjusted for real conditions
      const avgVehicleLengthM = 4.5 // Average vehicle length in meters
      const spacingFactor = 1.5 // Additional spacing factor
      const flowRateMethod3 = (density / 100) * speed * (1000 / 60) / (avgVehicleLengthM * spacingFactor)

      // Method 4: Simple proportional to vehicle count with congestion penalty
      const congestionPenalty = density > 50 ? 0.7 : density > 30 ? 0.85 : 1.0
      const flowRateMethod4 = (vehicleCount * 2) * congestionPenalty

      // Average of methods (excluding extremes)
      const methods = [flowRateMethod1, flowRateMethod2, flowRateMethod3, flowRateMethod4]
      const sortedMethods = methods.sort((a, b) => a - b)
      const dynamicFlowRate = (sortedMethods[1] + sortedMethods[2]) / 2 // Average of middle two

      return {
        direction,
        sensor_id: sensor.sensor_id,
        vehicle_count: vehicleCount,
        density_percent: density,
        speed_kmh: speed,
        flow_rates: {
          static_hardcoded: staticFlowRate,
          dynamic_calculated: Math.round(dynamicFlowRate * 100) / 100,
          method_1_count_based: Math.round(flowRateMethod1 * 100) / 100,
          method_2_density_speed: Math.round(flowRateMethod2 * 100) / 100,
          method_3_engineering: Math.round(flowRateMethod3 * 100) / 100,
          method_4_congestion: Math.round(flowRateMethod4 * 100) / 100
        },
        flow_improvement: {
          is_static: staticFlowRate === 120.0,
          difference_percent: staticFlowRate > 0 ? 
            Math.round(((dynamicFlowRate - staticFlowRate) / staticFlowRate) * 100) : 0,
          should_be_higher: dynamicFlowRate > staticFlowRate,
          should_be_lower: dynamicFlowRate < staticFlowRate
        },
        traffic_conditions: {
          congestion_level: density > 50 ? "high" : density > 30 ? "medium" : "low",
          speed_category: speed > 60 ? "fast" : speed > 40 ? "medium" : "slow",
          efficiency_score: Math.round((speedFactor * densityFactor) * 100)
        },
        timestamp: sensor.timestamp
      }
    })

    // Calculate intersection totals
    const totalStaticFlow = flowCalculations.reduce((sum, calc) => sum + calc.flow_rates.static_hardcoded, 0)
    const totalDynamicFlow = flowCalculations.reduce((sum, calc) => sum + calc.flow_rates.dynamic_calculated, 0)
    const totalVehicles = flowCalculations.reduce((sum, calc) => sum + calc.vehicle_count, 0)

    // Analyze flow distribution
    const flowVariance = flowCalculations.length > 1 ? 
      Math.sqrt(flowCalculations.reduce((sum, calc) => {
        const avgDynamic = totalDynamicFlow / flowCalculations.length
        return sum + Math.pow(calc.flow_rates.dynamic_calculated - avgDynamic, 2)
      }, 0) / flowCalculations.length) : 0


    res.json({
      intersection_id: intersectionId,
      analysis_summary: {
        problem_identified: "Flow rate hardcoded to 120.0 in Rust simulator",
        static_flow_total: totalStaticFlow,
        dynamic_flow_total: Math.round(totalDynamicFlow * 100) / 100,
        improvement_needed: totalStaticFlow === (flowCalculations.length * 120),
        total_vehicles: totalVehicles,
        flow_variance: Math.round(flowVariance * 100) / 100
      },
      flow_calculations_by_direction: flowCalculations,
      recommendations: [
        totalStaticFlow === (flowCalculations.length * 120) ? 
          "Update Rust simulator to calculate dynamic flow rates based on actual traffic conditions" : null,
        flowVariance < 10 ? 
          "Flow rates should vary more based on different traffic conditions per direction" : null,
        "Consider using density, speed, and vehicle count for realistic flow calculations",
        "Implement congestion penalties for high-density scenarios"
      ].filter(Boolean),
      calculation_methods: {
        method_1: "Vehicle count / average processing time",
        method_2: "Vehicle count * density factor * speed factor",
        method_3: "Traffic engineering approximation (density * speed / spacing)",
        method_4: "Proportional to vehicle count with congestion penalty",
        final_method: "Average of middle two methods (excluding extremes)"
      }
    })
  } catch (error) {
    console.error("Dynamic Flow Calculation Error:", error)
    res.status(500).json({ error: "Failed to calculate dynamic flow rates" })
  }
})

module.exports = router 