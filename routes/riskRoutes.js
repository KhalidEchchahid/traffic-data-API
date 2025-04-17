const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const { calculateRiskScore, calculateRiskScoreV1, identifyRiskFactors } = require("../utils/riskAnalysis")

// Risk analysis endpoint
router.get("/analysis", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const pipeline = [
      {
        $addFields: {
          riskScore: {
            $let: {
              vars: {
                data: "$$ROOT",
              },
              in: calculateRiskScore("$$data"),
            },
          },
          riskFactors: {
            $let: {
              vars: {
                data: "$$ROOT",
              },
              in: identifyRiskFactors("$$data"),
            },
          },
        },
      },
      {
        $match: { riskScore: { $gte: 40 } },
      },
      {
        $sort: { riskScore: -1 },
      },
      {
        $limit: 100,
      },
    ]

    const highRiskEvents = await collection.aggregate(pipeline).toArray()

    res.json(highRiskEvents)
  } catch (error) {
    console.error("Risk Analysis Error:", error)
    res.status(500).json({ error: "Failed to generate risk analysis" })
  }
})

// Risk heatmap
router.get("/heatmap", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const data = await collection
      .find({})
      .project({
        timestamp: 1,
        riskScore: 1,
        "trafficData.congestionLevel": 1,
        "trafficData.incidentDetected": 1,
        "trafficData.nearMissEvents": 1,
        "intersectionData.collisionCount": 1,
        "intersectionData.riskyBehaviorDetected": 1,
        "intersectionData.nearMissIncidents": 1,
        "intersectionData.suddenBrakingEvents": 1,
        "intersectionData.intersectionCongestionLevel": 1,
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()

    // Since we don't have actual location data, we'll generate coordinates
    const baseLatitude = 37.7749
    const baseLongitude = -122.4194

    // map of fixed locations to reuse for the same intersection data
    const locationMap = new Map()

    const formattedData = data.map((item, index) => {
      // Calculate risk factors based on available data
      const riskFactors = []

      if (item.trafficData?.incidentDetected) riskFactors.push("Incident")
      if (item.trafficData?.nearMissEvents > 0) riskFactors.push("Near Miss")
      if (item.intersectionData?.collisionCount > 0) riskFactors.push("Collision")
      if (item.intersectionData?.riskyBehaviorDetected) riskFactors.push("Risky Behavior")
      if (item.intersectionData?.nearMissIncidents > 0) riskFactors.push("Near Miss")
      if (item.intersectionData?.suddenBrakingEvents > 0) riskFactors.push("Sudden Braking")

      // Generate a consistent location for the same intersection
      const itemId = item._id.toString()
      let location

      if (locationMap.has(itemId)) {
        location = locationMap.get(itemId)
      } else {
        // Generate a location within a reasonable area
        const latitude = baseLatitude + (Math.random() - 0.5) * 0.1
        const longitude = baseLongitude + (Math.random() - 0.5) * 0.1
        location = { latitude, longitude }
        locationMap.set(itemId, location)
      }

      // Calculate a risk score if not present
      const riskScore = item.riskScore || calculateRiskScoreV1(item)

      return {
        id: itemId,
        timestamp: item.timestamp,
        riskScore: riskScore,
        latitude: location.latitude,
        longitude: location.longitude,
        congestionLevel:
          item.trafficData?.congestionLevel || item.intersectionData?.intersectionCongestionLevel || "medium",
        primaryFactor: riskFactors.length > 0 ? riskFactors[0] : "Unknown",
        incidents: riskFactors.length,
        location: `Intersection ${index + 1}`,
      }
    })

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch risk heatmap data" })
  }
})

// Risk Timeline
router.get("/timeline", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const data = await collection
      .find({ riskScore: { $gt: 70 } })
      .project({
        timestamp: 1,
        riskScore: 1,
        riskFactors: 1,
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()

    const formattedData = data.map((item) => ({
      id: item._id.toString(),
      timestamp: item.timestamp,
      riskScore: item.riskScore,
      severity: item.riskScore > 90 ? "critical" : item.riskScore > 80 ? "major" : "minor",
      factors: item.riskFactors,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch risk timeline data" })
  }
})

// Risk Factor Breakdown
router.get("/factors", async (req, res) => {
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const pipeline = [
      {
        $unwind: "$riskFactors",
      },
      {
        $group: {
          _id: "$riskFactors",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]

    const data = await collection.aggregate(pipeline).limit(100).toArray()

    const formattedData = data.map((item) => ({
      factor: item._id,
      count: item.count,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch risk factor breakdown data" })
  }
})

// Incident Log
router.get("/incidents", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const db = Database.getInstance()
  try {
    const collection = await db.getCollection()
    const data = await collection
      .find({ "trafficData.incidentDetected": true })
      .project({
        timestamp: 1,
        riskScore: 1,
        "trafficData.incidentType": 1,
        "intersectionData.location": 1,
        riskFactors: 1,
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()

    const formattedData = data.map((item) => ({
      id: item._id.toString(),
      timestamp: item.timestamp,
      riskScore: item.riskScore,
      incidentType: item.trafficData.incidentType,
      location: item.intersectionData.location,
      factors: item.riskFactors,
    }))

    res.json(formattedData)
  } catch (error) {
    console.error("DB Error:", error)
    res.status(500).json({ error: "Failed to fetch incident log data" })
  }
})

module.exports = router

