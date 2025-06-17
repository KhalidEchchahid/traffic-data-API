const express = require("express");
const router = express.Router();
const StreamService = require("../services/streamService");

// Initialize stream service
const streamService = StreamService.getInstance();

/**
 * Enhanced endpoint to receive traffic data from Kafka consumer
 * Now handles both legacy and enhanced intersection coordination data
 */
router.post("/traffic", (req, res) => {
  try {
    const data = req.body;
    
    // Detect enhanced intersection coordination data
    const isEnhanced = !!(data.intersection_id && (
      data.sensor_direction || 
      data.coordinated_weather || 
      data.vehicle_flow_rate !== undefined ||
      data.traffic_light_phase
    ));

    // Broadcast to connected clients with enhancement info
    streamService.broadcast("TRAFFIC", {
      ...data,
      _enhanced: isEnhanced,
      _received_at: new Date().toISOString()
    });

    res.status(200).json({ 
      success: true, 
      enhanced: isEnhanced,
      intersection_coordination: isEnhanced && data.intersection_id ? true : false
    });
  } catch (error) {
    console.error("Error broadcasting traffic data:", error);
    res.status(500).json({ error: "Failed to broadcast traffic data" });
  }
});

/**
 * Enhanced endpoint to receive intersection data from Kafka consumer
 * Now handles coordination status and efficiency metrics
 */
router.post("/intersection", (req, res) => {
  try {
    const data = req.body;
    
    // Detect enhanced intersection coordination data
    const isEnhanced = !!(data.intersection_id && (
      data.coordinated_light_status || 
      data.intersection_efficiency !== undefined ||
      data.total_intersection_vehicles !== undefined ||
      data.phase_time_remaining !== undefined
    ));

    // Broadcast to connected clients
    streamService.broadcast("INTERSECTION", {
      ...data,
      _enhanced: isEnhanced,
      _received_at: new Date().toISOString()
    });

    res.status(200).json({ 
      success: true, 
      enhanced: isEnhanced,
      coordination_features: isEnhanced ? [
        "light_coordination", 
        "efficiency_monitoring", 
        "vehicle_counting"
      ] : []
    });
  } catch (error) {
    console.error("Error broadcasting intersection data:", error);
    res.status(500).json({ error: "Failed to broadcast intersection data" });
  }
});

/**
 * NEW: Coordination endpoint to receive intersection coordination summaries
 * This is what the enhanced consumer sends for real-time coordination tracking
 */
router.post("/coordination", (req, res) => {
  try {
    const { intersection_id, coordination_state, message_type, enhanced_fields } = req.body;
    
    // Broadcast coordination update to connected clients
    streamService.broadcast("COORDINATION", {
      type: "intersection_coordination",
      intersection_id,
      coordination_state,
      message_type,
      enhanced_fields,
      timestamp: new Date().toISOString(),
      _coordination_summary: true
    });

    // Also broadcast as intersection update for general listeners
    streamService.broadcast("INTERSECTION", {
      type: "coordination_update",
      intersection_id,
      coordination_summary: coordination_state,
      enhanced_fields,
      timestamp: new Date().toISOString(),
      _coordination_summary: true
    });

    res.status(200).json({ 
      success: true,
      intersection_id,
      coordination_processed: true,
      sensors_tracked: coordination_state?.sensors?.length || 0,
      directions_tracked: coordination_state?.sensorDirections?.size || 0
    });
  } catch (error) {
    console.error("Error processing coordination data:", error);
    res.status(500).json({ error: "Failed to process coordination data" });
  }
});

/**
 * Endpoint to receive vehicle data from Kafka consumer
 */
router.post("/vehicle", (req, res) => {
  try {
    // Broadcast to connected clients
    streamService.broadcast("VEHICLE", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting vehicle data:", error);
    res.status(500).json({ error: "Failed to broadcast vehicle data" });
  }
});

/**
 * Endpoint to receive sensor health data from Kafka consumer
 */
router.post("/sensor", (req, res) => {
  try {
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
    // Broadcast to connected clients
    streamService.broadcast("ALERT", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting traffic alert:", error);
    res.status(500).json({ error: "Failed to broadcast traffic alert" });
  }
});

module.exports = router;
