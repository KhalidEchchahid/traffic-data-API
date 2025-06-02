require("dotenv").config()

const config = {
  // MongoDB Configuration
  MONGO_URI: process.env.MONGO_URI || "mongodb://admin:admin@localhost:27017",
  DB_NAME: process.env.DB_NAME || "traffic_db",
  COLLECTION_NAME: process.env.COLLECTION_NAME || "traffic_metrics",
  VEHICLE_COLLECTION: process.env.VEHICLE_COLLECTION || "vehicle_records",
  INTERSECTION_COLLECTION: process.env.INTERSECTION_COLLECTION || "intersections",
  SENSOR_HEALTH_COLLECTION: process.env.SENSOR_HEALTH_COLLECTION || "sensor_health",
  ALERTS_COLLECTION: process.env.ALERTS_COLLECTION || "alerts",

  // Server Configuration
  PORT: process.env.PORT || 3001,

  // SSE clients for real-time data streaming
  SSE_CLIENTS: {
    TRAFFIC: [],
    VEHICLE: [],
    INTERSECTION: [],
    SENSOR: [],
    ALERT: [],
    COORDINATION: [],
  },
}

module.exports = config

