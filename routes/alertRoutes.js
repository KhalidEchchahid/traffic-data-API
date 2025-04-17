const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Get all traffic alerts with pagination
router.get("/", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.ALERTS_COLLECTION)
    const { page = 1, limit = 50, type, sensor_id, start, end } = req.query

    const filter = {}

    // Filter by alert type if provided
    if (type) {
      filter.type = type
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
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
    res.status(500).json({ error: "Failed to fetch traffic alerts" })
  }
})

// Get alert statistics
router.get("/stats", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.ALERTS_COLLECTION)
    const { start, end } = req.query

    const filter = {}

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

    // Get alert type distribution
    const typePipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]

    const typeStats = await collection.aggregate(typePipeline).toArray()

    // Get alerts by sensor
    const sensorPipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$sensor_id",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]

    const sensorStats = await collection.aggregate(sensorPipeline).toArray()

    // Get alerts by hour of day
    const hourPipeline = [
      { $match: filter },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const hourStats = await collection.aggregate(hourPipeline).toArray()

    res.json({
      typeStats,
      sensorStats,
      hourStats,
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch alert statistics" })
  }
})

// Stream traffic alerts in real-time
router.get("/stream", (req, res) => {
  const streamService = StreamService.getInstance()
  streamService.addClient("ALERT", res)
})

module.exports = router

