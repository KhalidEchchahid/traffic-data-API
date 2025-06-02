const express = require("express")
const router = express.Router()
const Database = require("../db/database")

// Traffic Density vs Speed
router.get("/traffic", async (req, res) => {
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
        density: 1,
        speed: 1,
      })
      .sort({ timestamp: 1 })
      .toArray()

    const formattedData = data.map((item) => ({
      timestamp: item.timestamp,
      density: item.density,
      speed: item.speed,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch traffic density and speed data" })
  }
})

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

