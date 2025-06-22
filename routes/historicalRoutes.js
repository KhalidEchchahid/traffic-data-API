const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const config = require("../config/config")

// Traffic Density vs Speed - Enhanced for frontend integration
router.get("/traffic", async (req, res) => {
  const db = Database.getInstance()
  try {
    // Use the correct collection name from config
    const collection = await db.getCollection(config.COLLECTION_NAME) // traffic_metrics
    let { start, end, aggregation } = req.query
    
    // Set default time range to last 24 hours if not provided
    if (!start || !end) {
      const now = new Date()
      end = now.toISOString()
      start = new Date(now.getTime() -24 * 60 * 60 * 1000).toISOString() // 24 hours ago
    }
    
    const startDate = new Date(start)
    const endDate = new Date(end)
    

    // First, check if collection exists and has any data
    const totalCount = await collection.countDocuments()


    // Query with enhanced error handling - timestamp is a string from Rust
    let data;
    
    // If aggregation is requested, use MongoDB aggregation pipeline
    if (aggregation === 'hour') {
      console.log("📊 Using hourly aggregation pipeline")
      data = await collection.aggregate([
        {
          $match: {
            timestamp: { 
              $gte: startDate.toISOString(), 
              $lte: endDate.toISOString() 
            },
            density: { $exists: true, $ne: null },
            speed: { $exists: true, $ne: null }
          }
        },
        {
          $addFields: {
            parsedTimestamp: { $dateFromString: { dateString: "$timestamp" } }
          }
        },
        {
          $group: {
            _id: { 
              $dateToString: { 
                format: "%Y-%m-%d %H", 
                date: "$parsedTimestamp" 
              }
            },
            avgSpeed: { $avg: "$speed" },
            avgDensity: { $avg: "$density" },
            totalVolume: { $sum: "$vehicle_number" },
            latestTimestamp: { $last: "$timestamp" },
            sensor_id: { $last: "$sensor_id" },
            location_id: { $last: "$location_id" },
            dataPointsCount: { $sum: 1 }
          }
        },
        {
          $project: {
            timestamp: "$latestTimestamp",
            density: { $round: ["$avgDensity", 1] },
            speed: { $round: ["$avgSpeed", 1] },
            vehicle_number: { $round: ["$totalVolume", 0] },
            sensor_id: 1,
            location_id: 1,
            dataPointsCount: 1
          }
        },
        {
          $sort: { "_id": 1 }
        }
      ]).toArray()
      
      console.log(`📊 Hourly aggregation returned ${data.length} aggregated records`)
    } else {
      // Default query without aggregation
      data = await collection
        .find({
          // Since timestamp is a string, we need to use string comparison
          timestamp: { 
            $gte: startDate.toISOString(), 
            $lte: endDate.toISOString() 
          },
          density: { $exists: true, $ne: null },
          speed: { $exists: true, $ne: null }
        })
        .project({
          timestamp: 1,
          density: 1,
          speed: 1,
          vehicle_number: 1, // For volume calculation
          sensor_id: 1,
          location_id: 1,
          congestion_level: 1, // Additional useful fields
          weather_conditions: 1,
          vehicle_type_distribution: 1
        })
        .sort({ timestamp: 1 })
        .limit(1000) // Prevent excessive data
        .toArray()
    }

    console.log(`📊 Found ${data.length} historical traffic records`)

          // If no data found, try a broader query without time constraints for debugging
      if (data.length === 0) {
        console.log("📊 No data found in time range, checking for any traffic data...")
        const sampleData = await collection
          .find({ 
            density: { $exists: true, $ne: null },
            speed: { $exists: true, $ne: null }
          })
          .sort({ timestamp: -1 }) // Get latest data first
          .limit(5)
          .toArray()
        
        console.log(`📊 Sample data available: ${sampleData.length} records`)
        if (sampleData.length > 0) {
          console.log(`📊 Sample record timestamps:`, sampleData.map(d => d.timestamp))
          console.log(`📊 Date range requested: ${startDate.toISOString()} to ${endDate.toISOString()}`)
          
          // Check if we have recent data (last hour)
          const recentData = await collection
            .find({ 
              density: { $exists: true, $ne: null },
              speed: { $exists: true, $ne: null },
              timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
            })
            .sort({ timestamp: -1 })
            .limit(24) // Get last 24 records (roughly hourly)
            .toArray()
            
          if (recentData.length > 0) {
            console.log(`📊 Using ${recentData.length} recent records instead`)
            data = recentData
          }
        }

        // Generate mock data for development if still no real data exists
        if (data.length === 0 && totalCount === 0) {
          console.log("📊 No data in collection, generating mock data for development...")
          data = generateMockHistoricalData(startDate, endDate)
        }
      }

    // Format data for frontend (matching the expected structure)
    const formattedData = data.map((item) => ({
      timestamp: item.timestamp, // Keep as string (from Rust)
      density: item.density || 0,
      speed: item.speed || 0,
      // Additional fields that the frontend might use
      volume: item.vehicle_number || Math.round((item.density || 0) * 2), // Better volume calculation
      sensor_id: item.sensor_id,
      location_id: item.location_id,
      congestion_level: item.congestion_level,
      weather_conditions: item.weather_conditions,
      vehicle_types: item.vehicle_type_distribution || {},
      // Include aggregation metadata if available
      dataPointsCount: item.dataPointsCount || 1
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("📊 Historical traffic DB Error:", error)
    res.status(500).json({ 
      error: "Failed to fetch traffic density and speed data",
      details: error.message,
      collection: config.COLLECTION_NAME
    })
  }
})

// Helper function to generate mock historical data for development
function generateMockHistoricalData(startDate, endDate) {
  const data = []
  const timeDiff = endDate.getTime() - startDate.getTime()
  const hours = Math.min(24, Math.floor(timeDiff / (1000 * 60 * 60))) // Max 24 hours
  
  console.log(`📊 Generating ${hours} hours of mock data`)
  
  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(startDate.getTime() + (i * 60 * 60 * 1000))
    const hour = timestamp.getHours()
    
    // Simulate traffic patterns (higher during rush hours)
    let baseDensity = 20
    let baseSpeed = 45
    
    if (hour >= 7 && hour <= 9) { // Morning rush
      baseDensity = 80
      baseSpeed = 25
    } else if (hour >= 17 && hour <= 19) { // Evening rush
      baseDensity = 90
      baseSpeed = 20
    } else if (hour >= 12 && hour <= 14) { // Lunch time
      baseDensity = 60
      baseSpeed = 35
    } else if (hour >= 22 || hour <= 5) { // Night time
      baseDensity = 10
      baseSpeed = 55
    }
    
    // Add some randomness
    const density = Math.max(0, baseDensity + (Math.random() - 0.5) * 20)
    const speed = Math.max(10, baseSpeed + (Math.random() - 0.5) * 15)
    
    data.push({
      timestamp: timestamp,
      density: Math.round(density),
      speed: Math.round(speed * 10) / 10,
      vehicle_number: Math.round(density * 2),
      sensor_id: `mock-sensor-${Math.floor(Math.random() * 4) + 1}`,
      location_id: `mock-location-${i % 4}`
    })
  }
  
  return data
}

// Incident Frequency
router.get("/incidents", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const { start, end } = req.query
    const startDate = new Date(start)
    const endDate = new Date(end)

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          incident_detected: true,
        },
      },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          frequency: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    const formattedData = data.map((item) => ({
      hour: item._id,
      frequency: item.frequency,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch incident frequency data" })
  }
})

// Congestion Heatmap
router.get("/congestion", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const { start, end } = req.query
    const startDate = new Date(start)
    const endDate = new Date(end)

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: "$timestamp" },
            hour: { $hour: "$timestamp" },
          },
          avgCongestion: { 
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ["$congestion_level", "low"] }, then: 1 },
                  { case: { $eq: ["$congestion_level", "medium"] }, then: 2 },
                  { case: { $eq: ["$congestion_level", "high"] }, then: 3 },
                ],
                default: 0,
              },
            },
          },
        },
      },
      {
        $sort: { "_id.day": 1, "_id.hour": 1 },
      },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const formattedData = days.map((day) => {
      return {
        id: day,
        data: Array.from({ length: 24 }, (_, hour) => {
          const dataPoint = data.find((d) => d._id.day === days.indexOf(day) + 1 && d._id.hour === hour)
          return {
            x: hour.toString(),
            y: dataPoint ? dataPoint.avgCongestion : 0,
          }
        }),
      }
    })

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch congestion heatmap data" })
  }
})

// Weather Distribution
router.get("/weather", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const { start, end } = req.query
    const startDate = new Date(start)
    const endDate = new Date(end)

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$local_weather_conditions",
          count: { $sum: 1 },
        },
      },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    const formattedData = data.map((item) => ({
      name: item._id,
      value: item.count,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch weather distribution data" })
  }
})

// Advanced Data Table
router.get("/data", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const { start, end } = req.query
    const startDate = new Date(start)
    const endDate = new Date(end)

    const data = await collection
      .find({
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .project({
        timestamp: 1,
        riskScore: 1,
        congestion_level: 1,
        local_weather_conditions: 1,
        incident_detected: 1,
        vehicle_type_distribution: 1,
      })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray()

    const formattedData = data.map((item) => ({
      id: item._id.toString(),
      timestamp: item.timestamp,
      riskScore: item.riskScore,
      congestionLevel: item.congestion_level,
      weather: item.local_weather_conditions,
      incident: item.incident_detected ? "Yes" : "No",
      vehicleTypes: item.vehicle_type_distribution 
        ? Object.entries(item.vehicle_type_distribution)
            .map(([type, count]) => `${type}: ${count}`)
            .join(", ")
        : "N/A",
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch advanced data table" })
  }
})

// Average Historical Data
router.get("/average", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const pipeline = [
      {
        $group: {
          _id: null,
          avgDensity: { $avg: "$density" },
          avgSpeed: { $avg: "$speed" },
          avgRiskScore: { $avg: "$riskScore" },
          avgCongestionLevel: { 
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ["$congestion_level", "low"] }, then: 1 },
                  { case: { $eq: ["$congestion_level", "medium"] }, then: 2 },
                  { case: { $eq: ["$congestion_level", "high"] }, then: 3 },
                ],
                default: 0,
              },
            },
          },
        },
      },
    ]

    const result = await collection.aggregate(pipeline).toArray()

    if (result.length > 0) {
      const averageData = result[0]
      delete averageData._id
      res.json(averageData)
    } else {
      res.json({})
    }
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch average historical data" })
  }
})

module.exports = router

