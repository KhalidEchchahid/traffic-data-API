const config = require("../config/config");

/**
 * Service for managing Server-Sent Events (SSE) connections
 * and broadcasting real-time data to connected clients
 */
class StreamService {
  constructor() {
    this.clients = config.SSE_CLIENTS;
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send initial connection message
    res.write(
      `data: ${JSON.stringify({ message: "Connected to stream" })}\n\n`
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
   * Broadcast data to all clients of a specific stream
   * @param {string} stream - The stream type
   * @param {object} data - The data to broadcast
   */
  broadcast(stream, data) {
    if (!this.clients[stream]) {
      return;
    }

    const payload = JSON.stringify(data);

    this.clients[stream].forEach((client) => {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (error) {
        console.error(`Error broadcasting to client: ${error.message}`);
        this.removeClient(stream, client);
      }
    });
  }
}

module.exports = StreamService;
