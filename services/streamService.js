const config = require("../config/config");

/**
 * Enhanced Service for managing Server-Sent Events (SSE) connections
 * and broadcasting real-time data to connected clients with intersection coordination support
 */
class StreamService {
  constructor() {
    this.clients = config.SSE_CLIENTS;
    // NEW: Intersection-specific client tracking for enhanced Rust simulator
    this.intersectionClients = new Map(); // intersection_id -> { stream_type -> [clients] }
  }

  static getInstance() {
    if (!StreamService.instance) {
      StreamService.instance = new StreamService();
    }
    return StreamService.instance;
  }

  /**
   * Add a new client to the appropriate stream
   * @param {string} stream - The stream type (TRAFFIC, VEHICLE, etc.)
   * @param {object} res - Express response object
   */
  addClient(stream, res) {
    if (!this.clients[stream]) {
      throw new Error(`Stream type ${stream} not supported`);
    }

    // Set up SSE headers
    this.setupSSE(res);

    // Send initial connection message
    res.write(
      `data: ${JSON.stringify({ 
        message: "Connected to enhanced stream",
        stream_type: stream,
        enhanced_features: ["intersection_filtering", "weather_correlation", "real_time_coordination"],
        timestamp: new Date().toISOString()
      })}\n\n`
    );

    // Add client to the list
    this.clients[stream].push(res);

    // Handle client disconnect
    res.on("close", () => {
      this.removeClient(stream, res);
      console.log(`Client disconnected from ${stream} stream`);
    });

    console.log(
      `Client connected to ${stream} stream. Total clients: ${this.clients[stream].length}`
    );
  }

  /**
   * NEW: Add client to intersection-specific stream for enhanced coordination
   * @param {string} stream - The stream type (TRAFFIC, VEHICLE, etc.)
   * @param {string} intersectionId - The intersection ID
   * @param {object} res - Express response object
   */
  addIntersectionClient(stream, intersectionId, res) {
    console.log(`=== ADDING INTERSECTION CLIENT ===`)
    console.log(`Stream: ${stream}, Intersection: ${intersectionId}`)

    // Set up SSE headers
    this.setupSSE(res);

    // Initialize intersection tracking if needed
    if (!this.intersectionClients.has(intersectionId)) {
      this.intersectionClients.set(intersectionId, new Map());
    }

    const intersectionStreams = this.intersectionClients.get(intersectionId);
    if (!intersectionStreams.has(stream)) {
      intersectionStreams.set(stream, []);
    }

    // Add client to intersection-specific stream
    intersectionStreams.get(stream).push(res);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({
      message: "Connected to intersection-specific enhanced stream",
      stream_type: stream,
      intersection_id: intersectionId,
      enhanced_features: [
        "intersection_coordination",
        "weather_synchronization",
        "flow_tracking",
        "real_time_updates"
      ],
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Handle client disconnect
    res.on("close", () => {
      this.removeIntersectionClient(stream, intersectionId, res);
      console.log(`Client disconnected from ${stream} stream for intersection ${intersectionId}`);
    });

    const clientCount = intersectionStreams.get(stream).length;
    console.log(`Intersection client connected. ${stream}/${intersectionId}: ${clientCount} clients`);
  }

  /**
   * Set up standard SSE headers
   * @param {object} res - Express response object
   */
  setupSSE(res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });
  }

  /**
   * Remove a client from the stream
   * @param {string} stream - The stream type
   * @param {object} res - Express response object
   */
  removeClient(stream, res) {
    if (!this.clients[stream]) {
      return;
    }

    this.clients[stream] = this.clients[stream].filter(
      (client) => client !== res
    );
  }

  /**
   * NEW: Remove client from intersection-specific stream
   * @param {string} stream - The stream type
   * @param {string} intersectionId - The intersection ID
   * @param {object} res - Express response object
   */
  removeIntersectionClient(stream, intersectionId, res) {
    const intersectionStreams = this.intersectionClients.get(intersectionId);
    if (!intersectionStreams || !intersectionStreams.has(stream)) {
      return;
    }

    const clients = intersectionStreams.get(stream);
    const filteredClients = clients.filter(client => client !== res);
    intersectionStreams.set(stream, filteredClients);

    // Clean up empty intersection tracking
    if (filteredClients.length === 0) {
      intersectionStreams.delete(stream);
      if (intersectionStreams.size === 0) {
        this.intersectionClients.delete(intersectionId);
      }
    }
  }

  /**
   * Enhanced broadcast with intersection awareness
   * @param {string} stream - The stream type
   * @param {object} data - The data to broadcast
   */
  broadcast(stream, data) {
    if (!this.clients[stream]) {
      return;
    }

    // Enhanced payload with metadata
    const enhancedPayload = {
      ...data,
      timestamp: new Date().toISOString(),
      stream_type: stream,
      enhanced: !!(data.intersection_id || data.coordinated_weather || data.sensor_direction)
    };

    const payload = JSON.stringify(enhancedPayload);

    // Broadcast to global stream clients
    this.clients[stream].forEach((client) => {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (error) {
        console.error(`Error broadcasting to client: ${error.message}`);
        this.removeClient(stream, client);
      }
    });

    // NEW: Broadcast to intersection-specific clients if data has intersection_id
    if (data.intersection_id) {
      this.broadcastToIntersection(stream, data.intersection_id, enhancedPayload);
    }
  }

  /**
   * NEW: Broadcast to intersection-specific clients
   * @param {string} stream - The stream type
   * @param {string} intersectionId - The intersection ID
   * @param {object} data - The data to broadcast
   */
  broadcastToIntersection(stream, intersectionId, data) {
    const intersectionStreams = this.intersectionClients.get(intersectionId);
    if (!intersectionStreams || !intersectionStreams.has(stream)) {
      return;
    }

    const payload = JSON.stringify({
      ...data,
      intersection_specific: true,
      timestamp: new Date().toISOString()
    });

    const clients = intersectionStreams.get(stream);
    clients.forEach((client, index) => {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (error) {
        console.error(`Error broadcasting to intersection client: ${error.message}`);
        // Remove failed client
        clients.splice(index, 1);
      }
    });

    console.log(`📡 Broadcasted ${stream} data to ${clients.length} intersection ${intersectionId} clients`);
  }

  /**
   * NEW: Get statistics about connected clients
   */
  getConnectionStats() {
    const globalStats = {};
    Object.keys(this.clients).forEach(stream => {
      globalStats[stream] = this.clients[stream].length;
    });

    const intersectionStats = {};
    this.intersectionClients.forEach((streams, intersectionId) => {
      intersectionStats[intersectionId] = {};
      streams.forEach((clients, stream) => {
        intersectionStats[intersectionId][stream] = clients.length;
      });
    });

    return {
      global_streams: globalStats,
      intersection_streams: intersectionStats,
      total_intersections: this.intersectionClients.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * NEW: Broadcast coordination updates (for enhanced intersection coordination)
   * @param {string} intersectionId - The intersection ID
   * @param {object} coordinationData - Coordination data
   */
  broadcastCoordination(intersectionId, coordinationData) {
    const payload = {
      type: "coordination_update",
      intersection_id: intersectionId,
      data: coordinationData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all intersection-specific clients
    const intersectionStreams = this.intersectionClients.get(intersectionId);
    if (intersectionStreams) {
      intersectionStreams.forEach((clients, stream) => {
        clients.forEach(client => {
          try {
            client.write(`data: ${JSON.stringify(payload)}\n\n`);
          } catch (error) {
            console.error(`Error broadcasting coordination update: ${error.message}`);
          }
        });
      });
    }

    // Also broadcast to global COORDINATION clients if they exist
    if (this.clients.COORDINATION) {
      this.broadcast("COORDINATION", payload);
    }

    console.log(`🔗 Broadcasted coordination update for intersection ${intersectionId}`);
  }
}

module.exports = StreamService;
