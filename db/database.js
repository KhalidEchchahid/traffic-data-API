const { MongoClient } = require("mongodb");
const config = require("../config/config");

// Singleton pattern for MongoDB connection
class Database {
  constructor() {
    this.client = new MongoClient(config.MONGO_URI);
    this.dbName = config.DB_NAME;
    this.isConnected = false;
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log("Connected to MongoDB");
    }
    return this.client.db(this.dbName);
  }

  async getCollection(collectionName = config.COLLECTION_NAME) {
    const db = await this.connect();
    return db.collection(collectionName);
  }

  async close() {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log("Disconnected from MongoDB");
    }
  }
}

module.exports = Database;
