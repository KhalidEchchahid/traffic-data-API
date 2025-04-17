const express = require("express")
const cors = require("cors")
const config = require("./config/config")
const trafficRoutes = require("./routes/trafficRoutes")
const vehicleRoutes = require("./routes/vehicleRoutes")
const intersectionRoutes = require("./routes/intersectionRoutes")
const sensorRoutes = require("./routes/sensorRoutes")
const alertRoutes = require("./routes/alertRoutes")
const dataReceiverRoutes = require("./routes/dataReceiverRoutes")

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes for API endpoints
app.use("/api/traffic", trafficRoutes)
app.use("/api/vehicles", vehicleRoutes)
app.use("/api/intersections", intersectionRoutes)
app.use("/api/sensors", sensorRoutes)
app.use("/api/alerts", alertRoutes)

// Routes for receiving data from Kafka consumers
app.use("/api/receive", dataReceiverRoutes)

// Start server
const startServer = async () => {
  app.listen(config.PORT, () => {
    console.log(`Traffic API running on http://localhost:${config.PORT}`)
    console.log("Endpoints:")
    console.log("- GET /api/traffic - Traffic data")
    console.log("- GET /api/traffic/stream - Real-time traffic stream")
    console.log("- GET /api/vehicles - Vehicle records")
    console.log("- GET /api/vehicles/stream - Real-time vehicle data stream")
    console.log("- GET /api/intersections - Intersection data")
    console.log("- GET /api/intersections/stream - Real-time intersection data stream")
    console.log("- GET /api/sensors/health - Sensor health data")
    console.log("- GET /api/sensors/stream - Real-time sensor health stream")
    console.log("- GET /api/alerts - Traffic alerts")
    console.log("- GET /api/alerts/stream - Real-time traffic alerts stream")
    console.log("\nData Receiver Endpoints (for Kafka consumers):")
    console.log("- POST /api/receive/traffic - Receive traffic data")
    console.log("- POST /api/receive/vehicle - Receive vehicle data")
    console.log("- POST /api/receive/intersection - Receive intersection data")
    console.log("- POST /api/receive/sensor - Receive sensor health data")
    console.log("- POST /api/receive/alert - Receive traffic alerts")
  })
}

module.exports = { app, startServer }

