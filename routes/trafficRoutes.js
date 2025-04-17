const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const { calculateRiskScore, calculateRiskScoreV1, identifyRiskFactors } = require("../utils/riskAnalysis")
const config = require("../config/config")

// Historical Traffic Data Endpoint
router.get("/", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { page = 1, limit = 50, sensor_id, location_id, start, end } = req.query

    const filter = {}

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by location ID if provided
    if (location_id) {
      filter.location_id = location_id
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
    res.status(500).json({ error: "Failed to fetch traffic data" })
  }
})

// Traffic Density vs Speed
router.get("/density-speed", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { start, end, sensor_id } = req.query

    const filter = {}

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
      })
      .sort({ timestamp: 1 })
      .toArray()

    const formattedData = data.map((item) => ({
      timestamp: item.timestamp,
      density: item.density,
      speed: item.speed,
      sensor_id: item.sensor_id,
      location_id: item.location_id,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch traffic density and speed data" })
  }
})

// Weather Impact on Traffic
router.get("/weather-impact", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)

    const pipeline = [
      {
        $group: {
          _id: "$weather_conditions",
          avgDensity: { $avg: "$density" },
          avgSpeed: { $avg: "$speed" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    res.json(data)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch weather impact data" })
  }
})

// Vehicle Type Distribution
router.get("/vehicle-distribution", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { start, end, sensor_id } = req.query

    const filter = {}

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
        },
      },
    ]

    const result = await collection.aggregate(pipeline).toArray()

    if (result.length > 0) {
      const data = result[0]
      delete data._id

      // Format for pie chart
      const formattedData = [
        { name: "Cars", value: data.totalCars },
        { name: "Buses", value: data.totalBuses },
        { name: "Motorcycles", value: data.totalMotorcycles },
        { name: "Trucks", value: data.totalTrucks },
      ]

      res.json(formattedData)
    } else {
      res.json([])
    }
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch vehicle distribution data" })
  }
})

// Traffic Congestion by Time of Day
router.get("/congestion-time", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.COLLECTION_NAME)
    const { start, end, sensor_id } = req.query

    const filter = {}

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
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    const formattedData = data.map((item) => ({
      hour: item._id,
      avgDensity: item.avgDensity,
      avgSpeed: item.avgSpeed,
      count: item.count,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch congestion by time data" })
  }
})

// Real-Time Traffic Data Streaming
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const streamService = StreamService.getInstance()
  streamService.addClient("TRAFFIC", res)
})

module.exports = router

