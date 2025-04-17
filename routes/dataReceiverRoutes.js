const express = require("express");
const router = express.Router();
const StreamService = require("../services/streamService");

// Initialize stream service
const streamService = StreamService.getInstance();

/**
 * Endpoint to receive traffic data from Kafka consumer
 * This data is broadcast to connected clients but not stored in MongoDB
 * (storage is handled by the Kafka consumer)
 */
router.post("/traffic", (req, res) => {
  try {
    console.log("=== RECEIVED TRAFFIC DATA ===");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("============================");

    // Broadcast to connected clients
    streamService.broadcast("TRAFFIC", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting traffic data:", error);
    res.status(500).json({ error: "Failed to broadcast traffic data" });
  }
});

/**
 * Endpoint to receive vehicle data from Kafka consumer
 */
router.post("/vehicle", (req, res) => {
  try {
    console.log("=== RECEIVED VEHICLE DATA ===");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("============================");

    // Broadcast to connected clients
    streamService.broadcast("VEHICLE", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting vehicle data:", error);
    res.status(500).json({ error: "Failed to broadcast vehicle data" });
  }
});

/**
 * Endpoint to receive intersection data from Kafka consumer
 */
router.post("/intersection", (req, res) => {
  try {
    console.log("=== RECEIVED INTERSECTION DATA ===");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("==================================");

    // Broadcast to connected clients
    streamService.broadcast("INTERSECTION", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting intersection data:", error);
    res.status(500).json({ error: "Failed to broadcast intersection data" });
  }
});

/**
 * Endpoint to receive sensor health data from Kafka consumer
 */
router.post("/sensor", (req, res) => {
  try {
    console.log("=== RECEIVED SENSOR HEALTH DATA ===");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("==================================");

    // Broadcast to connected clients
    streamService.broadcast("SENSOR", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting sensor health data:", error);
    res.status(500).json({ error: "Failed to broadcast sensor health data" });
  }
});

/**
 * Endpoint to receive traffic alerts from Kafka consumer
 */
router.post("/alert", (req, res) => {
  try {
    console.log("=== RECEIVED TRAFFIC ALERT ===");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=============================");

    // Broadcast to connected clients
    streamService.broadcast("ALERT", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting traffic alert:", error);
    res.status(500).json({ error: "Failed to broadcast traffic alert" });
  }
});

module.exports = router;
