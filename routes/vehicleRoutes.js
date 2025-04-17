const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Get all vehicle records with pagination
router.get("/", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.VEHICLE_COLLECTION)
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
    res.status(500).json({ error: "Failed to fetch vehicle records" })
  }
})

// Get vehicle statistics
router.get("/stats", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.VEHICLE_COLLECTION)
    const { sensor_id, start, end } = req.query

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

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$vehicle_class",
          count: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          avgOccupancy: { $avg: "$occupancy_s" },
          avgTimeGap: { $avg: "$time_gap_s" },
        },
      },
      { $sort: { count: -1 } },
    ]

    const vehicleClassStats = await collection.aggregate(pipeline).toArray()

    // Get overall stats
    const overallPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalVehicles: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          maxSpeed: { $max: "$speed_kmh" },
          minSpeed: { $min: "$speed_kmh" },
          wrongWayCount: {
            $sum: {
              $cond: [{ $eq: [{ $binaryAnd: ["$status", 0x10] }, 0x10] }, 1, 0],
            },
          },
          queueDetectedCount: {
            $sum: {
              $cond: [{ $eq: [{ $binaryAnd: ["$status", 0x20] }, 0x20] }, 1, 0],
            },
          },
        },
      },
    ]

    const overallStats = await collection.aggregate(overallPipeline).toArray()

    // Get time-based distribution
    const timeDistributionPipeline = [
      { $match: filter },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const timeDistribution = await collection.aggregate(timeDistributionPipeline).toArray()

    res.json({
      vehicleClassStats,
      overallStats: overallStats[0] || {},
      timeDistribution,
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch vehicle statistics" })
  }
})

// Stream vehicle data in real-time
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const streamService = StreamService.getInstance()
  streamService.addClient("VEHICLE", res)
})

module.exports = router

