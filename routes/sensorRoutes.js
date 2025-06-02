const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Get sensor registry (NEW ENHANCED ENDPOINT)
router.get("/registry", async (req, res) => {
  const db = Database.getInstance()
  try {
    // Get unique sensors from intersection data (enhanced collection)
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const sensorPipeline = [
      {
        $group: {
          _id: "$sensor_id",
          latest_data: { $last: "$$ROOT" },
          first_seen: { $min: "$timestamp" },
          last_seen: { $max: "$timestamp" },
          data_points: { $sum: 1 }
        }
      },
      {
        $project: {
          sensor_id: "$_id",
          intersection_id: "$latest_data.intersection_id",
          sensor_direction: "$latest_data.sensor_direction",
          capabilities: {
            intersection_coordination: { $ifNull: ["$latest_data.coordinated_light_status", false] },
            weather_sync: { $ifNull: ["$latest_data.coordinated_weather", false] },
            flow_rate_detection: { $ifNull: ["$latest_data.vehicle_flow_rate", false] },
            queue_propagation: { $ifNull: ["$latest_data.queue_propagation_factor", false] },
            efficiency_metrics: { $ifNull: ["$latest_data.intersection_efficiency", false] }
          },
          status: "active",
          first_seen: 1,
          last_seen: 1,
          data_points: 1
        }
      },
      { $sort: { last_seen: -1 } }
    ]

    const intersectionSensors = await intersectionCollection.aggregate(sensorPipeline).toArray()

    // Also get sensors from traffic data
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    const trafficSensorPipeline = [
      {
        $group: {
          _id: "$sensor_id",
          latest_data: { $last: "$$ROOT" },
          first_seen: { $min: "$timestamp" },
          last_seen: { $max: "$timestamp" },
          data_points: { $sum: 1 }
        }
      },
      {
        $project: {
          sensor_id: "$_id",
          location_id: "$latest_data.location_id",
          sensor_direction: "$latest_data.sensor_direction",
          capabilities: {
            traffic_flow: true,
            density_detection: { $ifNull: ["$latest_data.density", false] },
            speed_detection: { $ifNull: ["$latest_data.speed", false] },
            incident_detection: { $ifNull: ["$latest_data.incident_detected", false] },
            weather_monitoring: { $ifNull: ["$latest_data.weather_conditions", false] }
          },
          status: "active",
          first_seen: 1,
          last_seen: 1,
          data_points: 1
        }
      },
      { $sort: { last_seen: -1 } }
    ]

    const trafficSensors = await trafficCollection.aggregate(trafficSensorPipeline).toArray()

    // Merge and deduplicate sensors
    const allSensors = {}
    
    intersectionSensors.forEach(sensor => {
      allSensors[sensor.sensor_id] = {
        ...sensor,
        type: 'intersection',
        enhanced_features: true
      }
    })

    trafficSensors.forEach(sensor => {
      if (allSensors[sensor.sensor_id]) {
        // Merge capabilities
        allSensors[sensor.sensor_id].capabilities = {
          ...allSensors[sensor.sensor_id].capabilities,
          ...sensor.capabilities
        }
        allSensors[sensor.sensor_id].type = 'hybrid'
      } else {
        allSensors[sensor.sensor_id] = {
          ...sensor,
          type: 'traffic',
          enhanced_features: false
        }
      }
    })

    res.json({
      total_sensors: Object.keys(allSensors).length,
      sensors: Object.values(allSensors)
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch sensor registry" })
  }
})

// Get geo-spatial sensor map (NEW ENHANCED ENDPOINT)
router.get("/map", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== SENSOR MAP ENDPOINT DEBUG ===")
    
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    
    // First, get sensor_direction from traffic collection (where it's actually stored)
    console.log("Getting sensor directions from traffic collection...")
    const trafficSensorData = await trafficCollection
      .aggregate([
        {
          $match: {
            sensor_direction: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: {
              sensor_id: "$sensor_id",
              intersection_id: "$intersection_id"
            },
            sensor_direction: { $last: "$sensor_direction" },
            last_seen: { $max: "$timestamp" },
            location_x: { $last: "$location_x" },
            location_y: { $last: "$location_y" }
          }
        },
        {
          $project: {
            sensor_id: "$_id.sensor_id",
            intersection_id: "$_id.intersection_id",
            sensor_direction: 1,
            last_seen: 1,
            location_x: 1,
            location_y: 1
          }
        }
      ])
      .toArray()

    console.log("Traffic sensor data found:", trafficSensorData.length)

    // Then, get additional sensor data from intersection collection
    console.log("Getting additional sensor data from intersection collection...")
    const intersectionSensorData = await intersectionCollection
      .aggregate([
        {
          $group: {
            _id: {
              sensor_id: "$sensor_id",
              intersection_id: "$intersection_id"
            },
            last_seen_intersection: { $max: "$timestamp" }
          }
        },
        {
          $project: {
            sensor_id: "$_id.sensor_id",
            intersection_id: "$_id.intersection_id",
            last_seen_intersection: 1
          }
        }
      ])
      .toArray()

    console.log("Intersection sensor data found:", intersectionSensorData.length)

    // Create a map for easy lookup of intersection data
    const intersectionMap = {}
    intersectionSensorData.forEach(sensor => {
      const key = `${sensor.sensor_id}_${sensor.intersection_id}`
      intersectionMap[key] = sensor
    })

    // Merge traffic data with intersection data and generate coordinates
    const sensorLocations = trafficSensorData.map(sensor => {
      const key = `${sensor.sensor_id}_${sensor.intersection_id}`
      const intersectionData = intersectionMap[key]
      
      // Use actual coordinates if available, otherwise generate mock coordinates
      let latitude, longitude
      
      if (sensor.location_y && sensor.location_x) {
        latitude = sensor.location_y
        longitude = sensor.location_x
      } else {
        // Generate mock coordinates based on intersection_id for consistency
        const seed = sensor.intersection_id?.charCodeAt(0) || Math.random()
        latitude = 33.5912 + (seed % 100) * 0.0001
        longitude = -7.6356 + (seed % 100) * 0.0001
      }
      
      return {
        sensor_id: sensor.sensor_id,
        intersection_id: sensor.intersection_id,
        sensor_direction: sensor.sensor_direction,
        last_seen: intersectionData?.last_seen_intersection || sensor.last_seen,
        latitude,
        longitude
      }
    })

    // If no traffic data with sensor_direction, fall back to intersection data only
    if (sensorLocations.length === 0) {
      console.log("No traffic data with sensor_direction found, using intersection data...")
      
      const fallbackSensorData = await intersectionCollection
        .aggregate([
          {
            $group: {
              _id: {
                sensor_id: "$sensor_id",
                intersection_id: "$intersection_id"
              },
              last_seen: { $max: "$timestamp" }
            }
          },
          {
            $project: {
              sensor_id: "$_id.sensor_id",
              intersection_id: "$_id.intersection_id",
              last_seen: 1,
              // Generate mock coordinates
              latitude: {
                $add: [33.5912, { $multiply: [{ $rand: {} }, 0.01] }]
              },
              longitude: {
                $add: [-7.6356, { $multiply: [{ $rand: {} }, 0.01] }]
              }
            }
          }
        ])
        .toArray()

      // Try to infer sensor_direction from sensor_id or intersection_id
      fallbackSensorData.forEach(sensor => {
        const sensorStr = (sensor.sensor_id || '').toLowerCase()
        const intersectionStr = (sensor.intersection_id || '').toLowerCase()
        
        // Infer direction from naming patterns
        let inferredDirection = null
        if (sensorStr.includes('north') || intersectionStr.includes('north') || sensorStr.includes('-n')) {
          inferredDirection = 'north'
        } else if (sensorStr.includes('south') || intersectionStr.includes('south') || sensorStr.includes('-s')) {
          inferredDirection = 'south'
        } else if (sensorStr.includes('east') || intersectionStr.includes('east') || sensorStr.includes('-e')) {
          inferredDirection = 'east'
        } else if (sensorStr.includes('west') || intersectionStr.includes('west') || sensorStr.includes('-w')) {
          inferredDirection = 'west'
        }
        
        sensor.sensor_direction = inferredDirection
        sensorLocations.push(sensor)
      })
    }

    console.log("Final sensor locations:", sensorLocations.length)
    console.log("Sensors with direction:", sensorLocations.filter(s => s.sensor_direction).length)

    res.json({
      type: "FeatureCollection",
      features: sensorLocations.map(sensor => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [sensor.longitude, sensor.latitude]
        },
        properties: {
          sensor_id: sensor.sensor_id,
          intersection_id: sensor.intersection_id,
          sensor_direction: sensor.sensor_direction,
          last_seen: sensor.last_seen
        }
      })),
      metadata: {
        total_sensors: sensorLocations.length,
        sensors_with_direction: sensorLocations.filter(s => s.sensor_direction).length,
        data_sources: {
          traffic_collection: trafficSensorData.length,
          intersection_collection: intersectionSensorData.length
        },
        debug: {
          collections_used: ['traffic_metrics', 'intersections'],
          coordinate_source: sensorLocations.some(s => s.location_x && s.location_y) 
            ? 'actual_coordinates' 
            : 'generated_mock_coordinates'
        }
      }
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch sensor map" })
  }
})

// Get sensor capabilities (NEW ENHANCED ENDPOINT)
router.get("/:id/capabilities", async (req, res) => {
  const db = Database.getInstance()
  try {
    const { id } = req.params
    
    // Check intersection collection for enhanced capabilities
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const intersectionData = await intersectionCollection
      .findOne({ sensor_id: id }, { sort: { timestamp: -1 } })

    // Check traffic collection for basic capabilities
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    const trafficData = await trafficCollection
      .findOne({ sensor_id: id }, { sort: { timestamp: -1 } })

    if (!intersectionData && !trafficData) {
      return res.status(404).json({ error: "Sensor not found" })
    }

    const capabilities = {
      sensor_id: id,
      enhanced_features: !!intersectionData,
      basic_capabilities: {
        traffic_flow: !!trafficData,
        density_detection: !!trafficData?.density,
        speed_detection: !!trafficData?.speed,
        incident_detection: !!trafficData?.incident_detected,
        weather_monitoring: !!trafficData?.weather_conditions
      }
    }

    if (intersectionData) {
      capabilities.enhanced_capabilities = {
        intersection_coordination: !!intersectionData.coordinated_light_status,
        weather_synchronization: !!intersectionData.coordinated_weather,
        flow_rate_analysis: !!intersectionData.vehicle_flow_rate,
        queue_propagation_tracking: !!intersectionData.queue_propagation_factor,
        efficiency_monitoring: !!intersectionData.intersection_efficiency,
        directional_sensing: !!intersectionData.sensor_direction,
        phase_timing: !!intersectionData.phase_time_remaining
      }
      
      capabilities.coordination_data = {
        intersection_id: intersectionData.intersection_id,
        sensor_direction: intersectionData.sensor_direction,
        current_efficiency: intersectionData.intersection_efficiency,
        last_update: intersectionData.timestamp
      }
    }

    res.json(capabilities)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch sensor capabilities" })
  }
})

// Get sensors by intersection (NEW ENHANCED ENDPOINT)
router.get("/intersection/:id", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== INTERSECTION SENSORS ENDPOINT DEBUG ===")
    console.log("Intersection ID:", req.params.id)
    
    const { id } = req.params
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    
    // First, get sensor_direction from traffic collection where it actually exists
    console.log("Getting sensor directions from traffic collection...")
    const trafficSensorData = await trafficCollection
      .aggregate([
        { 
          $match: { 
            intersection_id: id,
            sensor_direction: { $exists: true, $ne: null }
          } 
        },
        {
          $group: {
            _id: "$sensor_id",
            sensor_direction: { $last: "$sensor_direction" },
            latest_traffic_data: { $last: "$$ROOT" },
            traffic_data_points: { $sum: 1 }
          }
        }
      ])
      .toArray()

    console.log("Traffic sensor data found:", trafficSensorData.length)

    // Then, get intersection-specific data
    console.log("Getting intersection data...")
    const intersectionSensorData = await intersectionCollection
      .aggregate([
        { $match: { intersection_id: id } },
        {
          $group: {
            _id: "$sensor_id",
            latest_intersection_data: { $last: "$$ROOT" },
            intersection_data_points: { $sum: 1 }
          }
        }
      ])
      .toArray()

    console.log("Intersection sensor data found:", intersectionSensorData.length)

    // Create lookup maps
    const trafficMap = {}
    trafficSensorData.forEach(sensor => {
      trafficMap[sensor._id] = sensor
    })

    const intersectionMap = {}
    intersectionSensorData.forEach(sensor => {
      intersectionMap[sensor._id] = sensor
    })

    // Merge data from both collections
    const allSensorIds = new Set([
      ...trafficSensorData.map(s => s._id),
      ...intersectionSensorData.map(s => s._id)
    ])

    console.log("Total unique sensors found:", allSensorIds.size)

    const sensors = Array.from(allSensorIds).map(sensorId => {
      const trafficData = trafficMap[sensorId]
      const intersectionData = intersectionMap[sensorId]
      
      // Get sensor_direction from traffic data or try to infer it
      let sensorDirection = trafficData?.sensor_direction || null
      
      // If no traffic data direction, try to infer from sensor ID
      if (!sensorDirection) {
        const sensorStr = (sensorId || '').toLowerCase()
        if (sensorStr.includes('north') || sensorStr.includes('-n')) {
          sensorDirection = 'north'
        } else if (sensorStr.includes('south') || sensorStr.includes('-s')) {
          sensorDirection = 'south'
        } else if (sensorStr.includes('east') || sensorStr.includes('-e')) {
          sensorDirection = 'east'
        } else if (sensorStr.includes('west') || sensorStr.includes('-w')) {
          sensorDirection = 'west'
        }
      }

      // Build merged sensor data
      const mergedSensor = {
        _id: sensorId,
        sensor_id: sensorId,
        sensor_direction: sensorDirection,
        status: "active",
        data_points: (trafficData?.traffic_data_points || 0) + (intersectionData?.intersection_data_points || 0)
      }

      // Add intersection-specific data if available
      if (intersectionData?.latest_intersection_data) {
        const intData = intersectionData.latest_intersection_data
        mergedSensor.vehicle_flow_rate = intData.vehicle_flow_rate
        mergedSensor.queue_propagation_factor = intData.queue_propagation_factor
        mergedSensor.intersection_efficiency = intData.intersection_efficiency
        mergedSensor.coordinated_light_status = intData.coordinated_light_status
        mergedSensor.last_update = intData.timestamp
      }

      // Add traffic-specific data if available
      if (trafficData?.latest_traffic_data) {
        const traffData = trafficData.latest_traffic_data
        if (!mergedSensor.last_update || new Date(traffData.timestamp) > new Date(mergedSensor.last_update)) {
          mergedSensor.last_update = traffData.timestamp
        }
        // You can add more traffic-specific fields here if needed
        mergedSensor.traffic_flow_rate = traffData.vehicle_flow_rate
        mergedSensor.current_speed = traffData.speed
        mergedSensor.current_density = traffData.density
      }

      return mergedSensor
    })

    console.log("Final merged sensors:", sensors.length)
    console.log("Sensors with direction:", sensors.filter(s => s.sensor_direction).length)
    console.log("Unique coordinated_light_status values:", [...new Set(sensors.map(s => s.coordinated_light_status).filter(Boolean))])

    if (sensors.length === 0) {
      return res.status(404).json({ error: "No sensors found for intersection" })
    }

    res.json({
      intersection_id: id,
      total_sensors: sensors.length,
      sensors: sensors,
      metadata: {
        sensors_with_direction: sensors.filter(s => s.sensor_direction).length,
        data_sources: {
          traffic_sensors: trafficSensorData.length,
          intersection_sensors: intersectionSensorData.length
        },
        debug: {
          collections_merged: ['traffic_metrics', 'intersections'],
          direction_inference_applied: sensors.some(s => s.sensor_direction && !trafficMap[s.sensor_id]?.sensor_direction)
        }
      }
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch intersection sensors" })
  }
})



// Get latest health status for all sensors
router.get("/status", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.SENSOR_HEALTH_COLLECTION)

    // Get the latest health record for each sensor
    const pipeline = [
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: "$sensor_id",
          latestRecord: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: { newRoot: "$latestRecord" },
      },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    // Add a status field based on health metrics
    const statusData = data.map((sensor) => {
      let status = "healthy"
      const issues = []

      if (sensor.hw_fault) {
        status = "critical"
        issues.push("Hardware fault detected")
      }

      if (sensor.low_voltage) {
        status = status === "healthy" ? "warning" : status
        issues.push("Low voltage")
      }

      if (sensor.battery_level < 20) {
        status = status === "healthy" ? "warning" : status
        issues.push("Low battery")
      }

      if (sensor.temperature_c > 40) {
        status = status === "healthy" ? "warning" : status
        issues.push("High temperature")
      }

      return {
        ...sensor,
        status,
        issues,
      }
    })

    res.json(statusData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch sensor status" })
  }
})

// Get sensor health history for a specific sensor
router.get("/history/:sensorId", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.SENSOR_HEALTH_COLLECTION)
    const { start, end } = req.query
    const { sensorId } = req.params

    const filter = { sensor_id: sensorId }

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

    const data = await collection.find(filter).sort({ timestamp: 1 }).toArray()

    // Format data for time-series visualization
    const batteryHistory = data.map((record) => ({
      timestamp: record.timestamp,
      value: record.battery_level,
    }))

    const temperatureHistory = data.map((record) => ({
      timestamp: record.timestamp,
      value: record.temperature_c,
    }))

    const uptimeHistory = data.map((record) => ({
      timestamp: record.timestamp,
      value: record.uptime_s / 3600, // Convert to hours
    }))

    const faultHistory = data.map((record) => ({
      timestamp: record.timestamp,
      hw_fault: record.hw_fault,
      low_voltage: record.low_voltage,
    }))

    res.json({
      batteryHistory,
      temperatureHistory,
      uptimeHistory,
      faultHistory,
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch sensor history" })
  }
})

// Stream sensor health data in real-time
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const streamService = StreamService.getInstance()
  streamService.addClient("SENSOR", res)
})

module.exports = router

