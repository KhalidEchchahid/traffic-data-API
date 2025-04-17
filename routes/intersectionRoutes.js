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
    const { page = 1, limit = 50, intersection_id, sensor_id, start, end } = req.query

    const filter = {}

    // Filter by intersection ID if provided
    if (intersection_id) {
      filter.intersection_id = intersection_id
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
    res.status(500).json({ error: "Failed to fetch intersection data" })
  }
})

// Get intersection statistics
router.get("/stats", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const { intersection_id, sensor_id, start, end } = req.query

    const filter = {}

    // Filter by intersection ID if provided
    if (intersection_id) {
      filter.intersection_id = intersection_id
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

    const congestionStats = await collection.aggregate(congestionPipeline).toArray()

    // Get queue length over time
    const queuePipeline = [
      { $match: filter },
      {
        $project: {
          timestamp: 1,
          hour: { $hour: "$timestamp" },
          totalQueueLength: {
            $add: ["$queue_length_by_lane.lane1", "$queue_length_by_lane.lane2", "$queue_length_by_lane.lane3"],
          },
        },
      },
      {
        $group: {
          _id: "$hour",
          avgQueueLength: { $avg: "$totalQueueLength" },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const queueStats = await collection.aggregate(queuePipeline).toArray()

    // Get incident statistics
    const incidentPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCollisions: { $sum: "$collision_count" },
          totalNearMisses: { $sum: "$near_miss_incidents" },
          totalSuddenBraking: { $sum: "$sudden_braking_events" },
          totalWrongWay: { $sum: "$wrong_way_vehicles" },
          riskyBehaviorCount: {
            $sum: { $cond: ["$risky_behavior_detected", 1, 0] },
          },
          illegalParkingCount: {
            $sum: { $cond: ["$illegal_parking_detected", 1, 0] },
          },
        },
      },
    ]

    const incidentStats = await collection.aggregate(incidentPipeline).toArray()

    // Get pedestrian and cyclist activity
    const pedestrianPipeline = [
      { $match: filter },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          avgPedestrians: { $avg: "$pedestrians_crossing" },
          avgJaywalking: { $avg: "$jaywalking_pedestrians" },
          avgCyclists: { $avg: "$cyclists_crossing" },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const pedestrianStats = await collection.aggregate(pedestrianPipeline).toArray()

    res.json({
      congestionStats,
      queueStats,
      incidentStats: incidentStats[0] || {},
      pedestrianStats,
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch intersection statistics" })
  }
})

// Get congestion heatmap data
router.get("/congestion", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.INTERSECTION_COLLECTION)
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

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: "$timestamp" },
            hour: { $hour: "$timestamp" },
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
        },
      },
      { $sort: { "_id.day": 1, "_id.hour": 1 } },
    ]

    const data = await collection.aggregate(pipeline).toArray()

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

      intersectionMap[intersection][dayIndex].data[hour].y = item.avgCongestion
    })

    res.json(intersectionMap)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch congestion heatmap data" })
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

