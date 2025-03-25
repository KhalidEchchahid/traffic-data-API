const express = require("express");
const { MongoClient } = require("mongodb");
const { Kafka } = require("kafkajs");
const cors = require("cors");
const app = express();

// TODO: Separate file into multiple files for organisation
//  assignees: khalid 
//  labels: enhancement
//sanaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
// Middleware
app.use(cors());
app.use(express.json());

// TODO: Implement proper environment variable management
//   labels: security, refactor
//   Create .env file with template to remove hardcoded credentials
//  assignees: khalidEchchahid

// Configuration
const CONFIG = {
  MONGO_URI: "mongodb://admin:admin@localhost:27017",
  DB_NAME: "traffic_db",
  COLLECTION_NAME: "traffic_metrics",
  KAFKA_BROKERS: ["127.0.0.1:29092"],
  PORT: 3001,
};

// Kafka Setup
// TODO: Implement Redis caching for heavy aggregation endpoints
//  assignees: khalidEchchahid
//   labels: performance, enhancement
//   target endpoints: /api/traffic/stream, future other topics streams.
const kafka = new Kafka({ brokers: CONFIG.KAFKA_BROKERS });

// -------------------------------
//  Historical Data Endpoint (Full JSON)
// -------------------------------
app.get("/api/traffic", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const { timeframe = "24h", riskLevel } = req.query;
    const filter = {};

    // Time-based filtering
    const timeFilters = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    if (timeFilters[timeframe]) {
      filter.timestamp = {
        $gte: new Date(Date.now() - timeFilters[timeframe]),
      };
    }

    // Risk level filtering
    if (riskLevel) {
      filter["riskScore"] = { $gte: riskLevel };
    }

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(500)
      .toArray();

    res.json(data);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch historical data" });
  } finally {
    await client.close();
  }
});

// endpoint for Traffic Density vs Speed
app.get("/api/historical/traffic", async (req, res) => {
  // TODO(enhancement): Use a single MongoClient
  // No point having a new client for each route handler  (singleton pattern)
  // assignees: khalidEchchahid

  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .find({
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .project({
        timestamp: 1,
        "trafficData.density": 1,
        "trafficData.speed": 1,
      })
      .sort({ timestamp: 1 })
      .toArray();

    const formattedData = data.map((item) => ({
      timestamp: item.timestamp,
      density: item.trafficData.density,
      speed: item.trafficData.speed,
    }));

    console.log(formattedData);
    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch traffic density and speed data" });
  } finally {
    await client.close();
  }
});

// endpoint for Incident Frequency
app.get("/api/historical/incidents", async (req, res) => {
  console.log("is this bieng called");
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          "trafficData.incidentDetected": true,
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
    ];

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();

    const formattedData = data.map((item) => ({
      hour: item._id,
      frequency: item.frequency,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch incident frequency data" });
  } finally {
    await client.close();
  }
});

app.get("/api/historical/congestion", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

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
          avgCongestion: { $avg: "$trafficData.congestionLevel" },
        },
      },
      {
        $sort: { "_id.day": 1, "_id.hour": 1 },
      },
    ];

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const formattedData = days.map((day) => {
      return {
        id: day,
        data: Array.from({ length: 24 }, (_, hour) => {
          const dataPoint = data.find(
            (d) => d._id.day === days.indexOf(day) + 1 && d._id.hour === hour,
          );
          return {
            x: hour.toString(),
            y: dataPoint ? dataPoint.avgCongestion : 0,
          };
        }),
      };
    });

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch congestion heatmap data" });
  } finally {
    await client.close();
  }
});

// endpoint for Weather Distribution
app.get("/api/historical/weather", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$intersectionData.localWeatherConditions",
          count: { $sum: 1 },
        },
      },
    ];

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();

    const formattedData = data.map((item) => ({
      name: item._id,
      value: item.count,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch weather distribution data" });
  } finally {
    await client.close();
  }
});

// endpoint for Advanced Data Table
app.get("/api/historical/data", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .find({
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .project({
        timestamp: 1,
        riskScore: 1,
        "trafficData.congestionLevel": 1,
        "intersectionData.localWeatherConditions": 1,
        "trafficData.incidentDetected": 1,
        "trafficData.vehicleTypeDistribution": 1,
      })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();

    const formattedData = data.map((item) => ({
      id: item._id.toString(),
      timestamp: item.timestamp,
      riskScore: item.riskScore,
      congestionLevel: item.trafficData.congestionLevel,
      weather: item.intersectionData.localWeatherConditions,
      incident: item.trafficData.incidentDetected ? "Yes" : "No",
      vehicleTypes: Object.entries(item.trafficData.vehicleTypeDistribution)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", "),
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch advanced data table" });
  } finally {
    await client.close();
  }
});

// endpoint for Average Historical Data
app.get("/api/historical/average", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const pipeline = [
      {
        $group: {
          _id: null,
          avgDensity: { $avg: "$trafficData.density" },
          avgSpeed: { $avg: "$trafficData.speed" },
          avgRiskScore: { $avg: "$riskScore" },
          avgCongestionLevel: { $avg: "$trafficData.congestionLevel" },
        },
      },
    ];

    const result = await db
      .collection(CONFIG.COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();

    if (result.length > 0) {
      const averageData = result[0];
      delete averageData._id;
      res.json(averageData);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch average historical data" });
  } finally {
    await client.close();
  }
});

// -------------------------------
// Real-Time Full Data Streaming
// -------------------------------
app.get("/api/traffic/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const consumer = kafka.consumer({
    groupId: `full-stream-${Date.now()}`,
    sessionTimeout: 30000,
  });

  try {
    await consumer.connect();
    // TODO: Implement all our kafka topics with their respective component integration
    //  We need to setup further topics, like traffic-alert sensor-health etc, see Rust
    //  repo for more info.
    //  labels: help wanted, enhancement
    //  milestone: raspi-integration
    //  assignees: khalidEchchahid , aymanamkassou

    await consumer.subscribe({ topic: "traffic-data" });

    const sendFullData = ({ message }) => {
      try {
        const rawData = message.value.toString();
        const data = JSON.parse(rawData);

        // Add risk analysis parameters
        const enhancedData = {
          ...data,
          timestamp: new Date().toISOString(),
          riskScore: calculateRiskScore(data),
          riskFactors: identifyRiskFactors(data),
        };

        res.write(`data: ${JSON.stringify(enhancedData)}\n\n`);
      } catch (error) {
        console.error("Stream Error:", error);
      }
    };

    await consumer.run({ eachMessage: sendFullData });

    req.on("close", async () => {
      await consumer.disconnect();
    });
  } catch (error) {
    console.error("Stream Setup Error:", error);
    res.status(500).end();
  }
});

// -------------------------------
// Risk Analysis Endpoints
// -------------------------------
// Risk score calculation logic
const calculateRiskScore = (data) => {
  let score = 0;

  // Accident-related risks
  score += data.trafficData.incidentDetected ? 30 : 0;
  score += data.trafficData.nearMissEvents * 5;
  score += data.intersectionData.collisionCount * 20;

  // Traffic conditions
  score += data.trafficData.congestionLevel === "high" ? 15 : 0;
  score += data.intersectionData.queueLengthByLane.lane1 > 15 ? 10 : 0;

  // Environmental factors
  score += data.trafficData.visibility === "poor" ? 20 : 0;
  score += data.intersectionData.localWeatherConditions === "rain" ? 15 : 0;

  return Math.min(score, 100);
};

function calculateRiskScoreV1(item) {
  let score = 0;

  // Add weight for an incident if detected
  if (item.trafficData?.incidentDetected) {
    score += 50;
  }

  // Add weight for near miss events from traffic data
  score += (item.trafficData?.nearMissEvents || 0) * 5;

  // Add weight for collision count from intersection data
  score += (item.intersectionData?.collisionCount || 0) * 30;

  // Add weight for risky behavior detected
  if (item.intersectionData?.riskyBehaviorDetected) {
    score += 20;
  }

  // Add weight for near miss incidents in intersection data
  score += (item.intersectionData?.nearMissIncidents || 0) * 5;

  // Add weight for sudden braking events in intersection data
  score += (item.intersectionData?.suddenBrakingEvents || 0) * 3;

  // Instead of trafficData.lane1, use intersectionData.queueLengthByLane.lane1
  const lane1 = item.intersectionData?.queueLengthByLane?.lane1 ?? 0;
  score += Number(lane1) * 2;

  return score;
}

// Risk factors identification
const identifyRiskFactors = (data) => {
  const factors = [];

  if (data.trafficData.incidentDetected) factors.push("active-incident");
  if (data.intersectionData.collisionCount > 0)
    factors.push("recent-collisions");
  if (data.trafficData.congestionLevel === "high")
    factors.push("high-congestion");
  if (data.trafficData.visibility === "poor") factors.push("poor-visibility");
  if (data.intersectionData.riskyBehaviorDetected)
    factors.push("risky-behavior");

  return factors;
};

// Risk analysis endpoint
app.get("/api/risk-analysis", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

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
    ];

    const highRiskEvents = await db
      .collection(CONFIG.COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();

    res.json(highRiskEvents);
  } catch (error) {
    console.error("Risk Analysis Error:", error);
    res.status(500).json({ error: "Failed to generate risk analysis" });
  } finally {
    await client.close();
  }
});

// API for risk heatmap
app.get("/api/risk/heatmap", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);
    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
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
      .toArray();

    // Since we don't have actual location data, we'll generate coordinates
    const baseLatitude = 37.7749;
    const baseLongitude = -122.4194;

    // map of fixed locations to reuse for the same intersection data
    const locationMap = new Map();

    const formattedData = data.map((item, index) => {
      // Calculate risk factors based on available data
      const riskFactors = [];

      if (item.trafficData?.incidentDetected) riskFactors.push("Incident");
      if (item.trafficData?.nearMissEvents > 0) riskFactors.push("Near Miss");
      if (item.intersectionData?.collisionCount > 0)
        riskFactors.push("Collision");
      if (item.intersectionData?.riskyBehaviorDetected)
        riskFactors.push("Risky Behavior");
      if (item.intersectionData?.nearMissIncidents > 0)
        riskFactors.push("Near Miss");
      if (item.intersectionData?.suddenBrakingEvents > 0)
        riskFactors.push("Sudden Braking");

      // Generate a consistent location for the same intersection
      const itemId = item._id.toString();
      let location;

      if (locationMap.has(itemId)) {
        location = locationMap.get(itemId);
      } else {
        // Generate a location within a reasonable area
        const latitude = baseLatitude + (Math.random() - 0.5) * 0.1;
        const longitude = baseLongitude + (Math.random() - 0.5) * 0.1;
        location = { latitude, longitude };
        locationMap.set(itemId, location);
      }

      // Calculate a risk score if not present
      const riskScore = item.riskScore || calculateRiskScoreV1(item);

      return {
        id: itemId,
        timestamp: item.timestamp,
        riskScore: riskScore,
        latitude: location.latitude,
        longitude: location.longitude,
        congestionLevel:
          item.trafficData?.congestionLevel ||
          item.intersectionData?.intersectionCongestionLevel ||
          "medium",
        primaryFactor: riskFactors.length > 0 ? riskFactors[0] : "Unknown",
        incidents: riskFactors.length,
        location: `Intersection ${index + 1}`,
      };
    });

    console.log("my heatmap data should be called here ", formattedData);
    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch risk heatmap data" });
  } finally {
    await client.close();
  }
});

// endpoint for Risk Timeline
app.get("/api/risk/timeline", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .find({ riskScore: { $gt: 70 } })
      .project({
        timestamp: 1,
        riskScore: 1,
        riskFactors: 1,
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    const formattedData = data.map((item) => ({
      id: item._id.toString(),
      timestamp: item.timestamp,
      riskScore: item.riskScore,
      severity:
        item.riskScore > 90
          ? "critical"
          : item.riskScore > 80
            ? "major"
            : "minor",
      factors: item.riskFactors,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch risk timeline data" });
  } finally {
    await client.close();
  }
});

// endpoint for Risk Factor Breakdown
app.get("/api/risk/factors", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

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
    ];

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
      .aggregate(pipeline)
      .limit(100)
      .toArray();

    const formattedData = data.map((item) => ({
      factor: item._id,
      count: item.count,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch risk factor breakdown data" });
  } finally {
    await client.close();
  }
});

// endpoint for Incident Log
app.get("/api/risk/incidents", async (req, res) => {
  const client = new MongoClient(CONFIG.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    const data = await db
      .collection(CONFIG.COLLECTION_NAME)
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
      .toArray();

    const formattedData = data.map((item) => ({
      id: item._id.toString(),
      timestamp: item.timestamp,
      riskScore: item.riskScore,
      incidentType: item.trafficData.incidentType,
      location: item.intersectionData.location,
      factors: item.riskFactors,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch incident log data" });
  } finally {
    await client.close();
  }
});

// Start server
app.listen(CONFIG.PORT, () => {
  console.log(`Traffic API running on http://localhost:${CONFIG.PORT}`);
  console.log("Endpoints:");
  console.log("- GET /api/traffic - Full historical data");
  console.log("- GET /api/traffic/stream - Full real-time stream");
  console.log("- GET /api/risk-analysis - Risk analysis data");
  console.log("- GET /api/historical/traffic - Traffic density vs speed data");
  console.log("- GET /api/historical/incidents - Incident frequency data");
  console.log("- GET /api/historical/congestion - Congestion heatmap data");
  console.log("- GET /api/historical/weather - Weather distribution data");
  console.log("- GET /api/historical/data - Advanced data table");
  console.log("- GET /api/historical/average - Average historical data");
});
