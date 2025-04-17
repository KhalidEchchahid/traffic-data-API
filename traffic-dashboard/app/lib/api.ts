"use client";

import {
  IntersectionData,
  AlertData,
  TrafficData,
  VehicleData,
} from "../types";
import { showAlertToast } from "../components/ToastProvider";

// Define callback types
type DataCallback<T> = (data: T) => void;

class TrafficApi {
  private readonly API_BASE_URL = ""; // Empty for relative URLs
  private readonly API_PATH = "/api";
  private pollingIntervals: Record<string, NodeJS.Timeout> = {};

  constructor() {
    // Nothing to initialize
  }

  // Get intersection data from the API
  async getIntersectionData(
    intersectionId?: string
  ): Promise<IntersectionData> {
    const url = intersectionId
      ? `${this.API_PATH}/intersections/${intersectionId}`
      : `${this.API_PATH}/intersections`;

    try {
      console.log(`Fetching intersection data from: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch intersection data: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("Received intersection data:", data);

      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }

      return data;
    } catch (error) {
      console.error("Error fetching intersection data:", error);
      // Fallback data for development - will be replaced with real data in production
      return {
        id: "mock-1",
        intersection_id: "bd-anfa-bd-zerktouni",
        stopped_vehicles_count: 25,
        pedestrian_count: 12,
        bicycle_count: 5,
        average_wait_time: 53,
        left_turn_count: 16,
        right_turn_count: 4,
        intersection_congestion_level: "medium",
        traffic_light_status: "green",
        local_weather_conditions: "clear",
        fog_or_smoke_detected: false,
        risky_behavior_detected: false,
        sudden_braking_events: 2,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Get traffic data from the API
  async getTrafficData(locationId?: string): Promise<TrafficData> {
    const url = locationId
      ? `${this.API_PATH}/traffic/location/${locationId}`
      : `${this.API_PATH}/traffic`;

    try {
      console.log(`Fetching traffic data from: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch traffic data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Received traffic data:", data);

      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }

      return data;
    } catch (error) {
      console.error("Error fetching traffic data:", error);
      // Fallback data for development - will be replaced with real data in production
      return {
        id: "mock-1",
        timestamp: new Date().toISOString(),
        traffic_flow_rate: 120,
        average_vehicle_speed: 45,
        traffic_congestion_level: "medium",
        road_surface_condition: "dry",
        emergency_vehicle_detected: false,
        location_x: -7.6356,
        location_y: 33.5912,
      };
    }
  }

  // Get alerts from the API
  async getAlerts(): Promise<AlertData[]> {
    const url = `${this.API_PATH}/alerts`;

    try {
      console.log(`Fetching alert data from: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alert data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Received alert data:", data);

      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error("Error fetching alert data:", error);
      return [];
    }
  }

  // Get vehicle data from the API
  async getVehicleData(): Promise<VehicleData[]> {
    const url = `${this.API_PATH}/vehicles`;

    try {
      console.log(`Fetching vehicle data from: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vehicle data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Received vehicle data:", data);

      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error("Error fetching vehicle data:", error);
      return [];
    }
  }

  // Start polling for data at regular intervals
  startPolling<T>(
    dataType: string,
    callback: DataCallback<T>,
    interval = 5000
  ): () => void {
    const fetchDataByType = async () => {
      try {
        let data;
        switch (dataType) {
          case "intersection":
            data = await this.getIntersectionData();
            break;
          case "traffic":
            data = await this.getTrafficData();
            break;
          case "alert":
            const alerts = await this.getAlerts();
            if (alerts.length > 0) {
              // Show the most recent alert as a toast
              showAlertToast(alerts[0]);
              data = alerts;
            }
            break;
          case "vehicle":
            const vehicles = await this.getVehicleData();
            if (vehicles.length > 0) {
              data = vehicles;
            }
            break;
          default:
            console.error("Unknown data type for polling:", dataType);
            return;
        }

        if (data) {
          callback(data as T);
        }
      } catch (error) {
        console.error(`Error polling for ${dataType} data:`, error);
      }
    };

    // Clear any existing interval for this data type
    if (this.pollingIntervals[dataType]) {
      clearInterval(this.pollingIntervals[dataType]);
    }

    // Set up a new polling interval
    this.pollingIntervals[dataType] = setInterval(fetchDataByType, interval);

    // Fetch immediately on start
    fetchDataByType();

    // Return cleanup function
    return () => {
      if (this.pollingIntervals[dataType]) {
        clearInterval(this.pollingIntervals[dataType]);
        delete this.pollingIntervals[dataType];
      }
    };
  }

  // Stop polling
  stopPolling(dataType?: string) {
    if (dataType) {
      if (this.pollingIntervals[dataType]) {
        clearInterval(this.pollingIntervals[dataType]);
        delete this.pollingIntervals[dataType];
      }
    } else {
      // Stop all polling intervals
      Object.keys(this.pollingIntervals).forEach((key) => {
        clearInterval(this.pollingIntervals[key]);
        delete this.pollingIntervals[key];
      });
    }
  }
}

// Singleton instance
export const trafficApi = new TrafficApi();
