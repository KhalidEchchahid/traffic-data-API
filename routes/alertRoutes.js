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
      // We'll handle timestamp filtering in aggregation instead of here
      // because we need to convert string timestamps to dates first
      console.log("Time range filtering will be handled in aggregation pipelines")
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
  const db = Database.getInstance()
  try {
    console.log("=== ALERT STATS DEBUG ===")
    console.log("Collection name:", config.ALERTS_COLLECTION)
    
    const collection = await db.getCollection(config.ALERTS_COLLECTION)
    console.log("Collection obtained successfully")
    
    const { type, sensor_id, start, end } = req.query
    console.log("Query parameters:", { type, sensor_id, start, end })

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
      // We'll handle timestamp filtering in aggregation instead of here
      // because we need to convert string timestamps to dates first
      console.log("Time range filtering will be handled in aggregation pipelines")
    }

    console.log("Filter:", JSON.stringify(filter, null, 2))

    // Check if collection exists and has data
    const collectionExists = await collection.countDocuments({})
    console.log("Total documents in collection:", collectionExists)

    if (collectionExists === 0) {
      console.log("⚠️ Alert collection is empty - returning empty stats")
      return res.json({
        totalAlerts: 0,
        recentAlertsCount: 0,
        highPriorityCount: 0,
        alertsByType: [],
        alertsBySeverity: [],
        alertsBySensor: [],
        resolvedStatus: { resolved: 0, unresolved: 0 },
        hourlyDistribution: [],
        averageResolutionTime: null,
        totalResolvedAlerts: 0,
        message: "No alert data available"
      })
    }

    // Sample one document to see the structure
    const sampleDoc = await collection.findOne({})
    console.log("Sample document structure:", JSON.stringify(sampleDoc, null, 2))

    // Create a base pipeline stage for timestamp conversion and filtering
    const createBaseFilter = () => {
      const baseStages = [
        {
          $addFields: {
            timestampDate: {
              $switch: {
                branches: [
                  {
                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                    then: "$timestamp"
                  },
                  {
                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                    then: {
                      $dateFromString: { 
                        dateString: "$timestamp",
                        onError: new Date() // Fallback to current date if parsing fails
                      }
                    }
                  }
                ],
                default: new Date() // Fallback for any other type
              }
            }
          }
        }
      ]

      // Add time range filtering if provided
      if (start || end) {
        const timeFilter = {}
        if (start) {
          timeFilter.$gte = new Date(start)
        }
        if (end) {
          timeFilter.$lte = new Date(end)
        }
        baseStages.push({
          $match: {
            ...filter,
            timestampDate: timeFilter
          }
        })
      } else {
        baseStages.push({ $match: filter })
      }

      return baseStages
    }

    // Get total count with proper timestamp handling
    console.log("Getting total count...")
    const totalCountPipeline = [
      ...createBaseFilter(),
      { $count: "total" }
    ]
    const totalCountResult = await collection.aggregate(totalCountPipeline).toArray()
    const totalAlerts = totalCountResult[0]?.total || 0
    console.log("Total alerts with filter:", totalAlerts)

    // Get alerts by type
    console.log("Getting alerts by type...")
    const alertsByTypePipeline = [
      ...createBaseFilter(),
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]

    const alertsByType = await collection.aggregate(alertsByTypePipeline).toArray()
    console.log("Alerts by type:", alertsByType)

    // Get alerts by severity
    console.log("Getting alerts by severity...")
    const alertsBySeverityPipeline = [
      ...createBaseFilter(),
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]

    const alertsBySeverity = await collection.aggregate(alertsBySeverityPipeline).toArray()
    console.log("Alerts by severity:", alertsBySeverity)

    // Get alerts by sensor
    console.log("Getting alerts by sensor...")
    const alertsBySensorPipeline = [
      ...createBaseFilter(),
      {
        $group: {
          _id: "$sensor_id",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 }, // Top 10 sensors
    ]

    const alertsBySensor = await collection.aggregate(alertsBySensorPipeline).toArray()
    console.log("Alerts by sensor:", alertsBySensor)

    // Get resolved vs unresolved alerts
    console.log("Getting resolution status...")
    const resolvedStatusPipeline = [
      ...createBaseFilter(),
      {
        $group: {
          _id: "$resolved",
          count: { $sum: 1 },
        },
      },
    ]

    const resolvedStatus = await collection.aggregate(resolvedStatusPipeline).toArray()
    console.log("Resolution status:", resolvedStatus)

    // Get hourly distribution
    console.log("Getting hourly distribution...")
    const hourlyDistributionPipeline = [
      ...createBaseFilter(),
      {
        $group: {
          _id: { $hour: "$timestampDate" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const hourlyDistribution = await collection.aggregate(hourlyDistributionPipeline).toArray()
    console.log("Hourly distribution:", hourlyDistribution)

    // Get recent alerts (last 24 hours)
    console.log("Getting recent alerts...")
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    // Handle both string and Date timestamps for recent alerts filter
    const recentAlertsFilter = {
      ...filter,
      $or: [
        // If timestamp is a Date
        { 
          timestamp: { 
            $type: "date",
            $gte: last24Hours 
          }
        },
        // If timestamp is a string
        {
          timestamp: {
            $type: "string",
            $gte: last24Hours.toISOString()
          }
        }
      ]
    }
    
    // For simpler approach, let's use aggregation for recent count too
    const recentAlertsPipeline = [
      ...createBaseFilter(),
      {
        $match: {
          timestampDate: { $gte: last24Hours }
        }
      },
      {
        $count: "recentCount"
      }
    ]
    
    const recentAlertsResult = await collection.aggregate(recentAlertsPipeline).toArray()
    const recentAlertsCount = recentAlertsResult[0]?.recentCount || 0
    console.log("Recent alerts count:", recentAlertsCount)

    // Get high priority alerts count
    console.log("Getting high priority alerts...")
    const highPriorityPipeline = [
      ...createBaseFilter(),
      {
        $match: { severity: { $in: ["high", "critical"] } }
      },
      {
        $count: "highPriorityCount"
      }
    ]
    const highPriorityResult = await collection.aggregate(highPriorityPipeline).toArray()
    const highPriorityCount = highPriorityResult[0]?.highPriorityCount || 0
    console.log("High priority count:", highPriorityCount)

    // Get average resolution time (for resolved alerts)
    console.log("Getting resolution time...")
    const averageResolutionPipeline = [
      ...createBaseFilter(),
      {
        $match: { resolved: true, resolution_time: { $exists: true } }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: "$resolution_time" },
          totalResolved: { $sum: 1 },
        },
      },
    ]

    const resolutionTimeData = await collection.aggregate(averageResolutionPipeline).toArray()
    console.log("Resolution time data:", resolutionTimeData)

    console.log("Building final response...")
    const response = {
      totalAlerts,
      recentAlertsCount,
      highPriorityCount,
      alertsByType: alertsByType.map(item => ({
        type: item._id,
        count: item.count,
      })),
      alertsBySeverity: alertsBySeverity.map(item => ({
        severity: item._id || "unknown",
        count: item.count,
      })),
      alertsBySensor: alertsBySensor.map(item => ({
        sensor_id: item._id,
        count: item.count,
      })),
      resolvedStatus: {
        resolved: resolvedStatus.find(item => item._id === true)?.count || 0,
        unresolved: resolvedStatus.find(item => item._id === false)?.count || 0,
      },
      hourlyDistribution: hourlyDistribution.map(item => ({
        hour: item._id,
        count: item.count,
      })),
      averageResolutionTime: resolutionTimeData[0]?.avgResolutionTime || null,
      totalResolvedAlerts: resolutionTimeData[0]?.totalResolved || 0,
    }

    console.log("=== ALERT STATS SUCCESS ===")
    res.json(response)
  } catch (error) {
    console.error("=== ALERT STATS ERROR ===")
    console.error("Error details:", error)
    console.error("Error stack:", error.stack)
    console.error("Config ALERTS_COLLECTION:", config.ALERTS_COLLECTION)
    res.status(500).json({ 
      error: "Failed to fetch alert statistics",
      details: error.message,
      collection: config.ALERTS_COLLECTION
    })
  }
})

// Get alert count
router.get("/count", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection(config.ALERTS_COLLECTION)
    const { type, sensor_id, severity, resolved, start, end } = req.query

    const filter = {}

    // Filter by alert type if provided
    if (type) {
      filter.type = type
    }

    // Filter by sensor ID if provided
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // Filter by severity if provided
    if (severity) {
      filter.severity = severity
    }

    // Filter by resolution status if provided
    if (resolved !== undefined) {
      filter.resolved = resolved === 'true'
    }

    // Filter by time range if provided
    if (start || end) {
      // We'll handle timestamp filtering in aggregation instead of here
      // because we need to convert string timestamps to dates first
      console.log("Time range filtering will be handled in aggregation pipelines")
    }

    const count = await collection.countDocuments(filter)

    res.json({
      count,
      filters: {
        type: type || null,
        sensor_id: sensor_id || null,
        severity: severity || null,
        resolved: resolved !== undefined ? resolved === 'true' : null,
        time_range: {
          start: start || null,
          end: end || null,
        },
      },
    })
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch alert count" })
  }
})

// Debug endpoint to check alerts collection status
router.get("/debug", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== ALERTS DEBUG ENDPOINT ===")
    
    // Check database connection
    const database = await db.connect()
    console.log("Database connected:", database.databaseName)
    
    // List all collections
    const collections = await database.listCollections().toArray()
    console.log("Available collections:", collections.map(c => c.name))
    
    // Check specific alerts collection
    const alertsCollectionName = config.ALERTS_COLLECTION
    console.log("Looking for collection:", alertsCollectionName)
    
    const alertsExists = collections.find(c => c.name === alertsCollectionName)
    
    if (!alertsExists) {
      return res.json({
        status: "Collection not found",
        expected_collection: alertsCollectionName,
        available_collections: collections.map(c => c.name),
        suggestion: "Check if Kafka consumers are running and producing data"
      })
    }
    
    // Collection exists, check its contents
    const collection = await db.getCollection(alertsCollectionName)
    const count = await collection.countDocuments({})
    
    let sampleDoc = null
    if (count > 0) {
      sampleDoc = await collection.findOne({})
    }
    
    // Check for common alert collection names
    const possibleCollections = ["alerts", "traffic_alerts", "traffic-alerts", "alert_history"]
    const collectionData = {}
    
    for (const collName of possibleCollections) {
      try {
        const tempCollection = database.collection(collName)
        const tempCount = await tempCollection.countDocuments({})
        if (tempCount > 0) {
          const tempSample = await tempCollection.findOne({})
          collectionData[collName] = {
            count: tempCount,
            sample: tempSample
          }
        }
      } catch (err) {
        // Collection doesn't exist, that's fine
      }
    }
    
    res.json({
      status: "Debug information",
      database: database.databaseName,
      configured_collection: alertsCollectionName,
      collection_exists: !!alertsExists,
      document_count: count,
      sample_document: sampleDoc,
      possible_alert_collections: collectionData,
      all_collections: collections.map(c => c.name)
    })
    
  } catch (error) {
    console.error("Debug endpoint error:", error)
    res.status(500).json({
      error: "Debug endpoint failed",
      details: error.message
    })
  }
})

// Stream traffic alerts in real-time
router.get("/stream", (req, res) => {
  const streamService = StreamService.getInstance()
  streamService.addClient("ALERT", res)
})

module.exports = router

