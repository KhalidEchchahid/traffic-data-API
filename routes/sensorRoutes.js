const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Get all sensor health data with pagination
router.get("/health", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.SENSOR_HEALTH_COLLECTION)
    const { page = 1, limit = 50, sensor_id, start, end } = req.query

    const filter = {}

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
    res.status(500).json({ error: "Failed to fetch sensor health data" })
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

