# MongoDB Collections Documentation for Traffic Data System

Big Daddy, this comprehensive documentation explains all MongoDB collections and their schemas for seamless backend endpoint development with the enhanced traffic monitoring system.

## Executive Summary

This document provides complete specifications for the **5 core MongoDB collections** that store enhanced traffic data from the Rust Traffic Simulator. The system maintains backwards compatibility while providing enhanced intersection coordination features through additional fields in existing collections.

## 🏗️ Collection Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Kafka Topics      │───▶│  Enhanced Mongo     │───▶│   MongoDB           │
│                     │    │   Consumer          │    │   Collections       │
│ • raw-vehicle-data  │    │                     │    │ • vehicle_records   │
│ • traffic-data      │    │ • Schema Detection  │    │ • traffic_metrics   │
│ • intersection-data │    │ • Index Creation    │    │ • intersections     │
│ • sensor-health     │    │ • Coordination      │    │ • sensor_health     │
│ • traffic-alerts    │    │   Tracking          │    │ • alerts            │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 📊 Topic to Collection Mapping

| Kafka Topic | MongoDB Collection | API Endpoint | Enhanced Schema |
|------------|-------------------|--------------|-----------------|
| `raw-vehicle-data` | `vehicle_records` | `/api/receive/vehicle` | ✅ Basic |
| `traffic-data` | `traffic_metrics` | `/api/receive/traffic` | 🚀 **Enhanced** |
| `intersection-data` | `intersections` | `/api/receive/intersection` | 🚀 **Enhanced** |
| `sensor-health` | `sensor_health` | `/api/receive/sensor` | ✅ Basic |
| `traffic-alerts` | `alerts` | `/api/receive/alert` | ✅ Basic |

**Additional Collections:**
| Collection | Purpose | Source |
|-----------|---------|--------|
| `sensors` | Sensor registry and capabilities | Enhanced Consumer |

---

## 🚗 Collection 1: `vehicle_records`

**Source**: `raw-vehicle-data` Kafka topic  
**Purpose**: Individual vehicle detection events from traffic sensors  
**Schema Version**: 1.0 (Legacy compatible)  
**Expected Volume**: ~1000-5000 documents/minute per sensor

### Document Schema

```typescript
interface VehicleRecord {
  // === Core Vehicle Data ===
  id: string;                    // UUID: "550e8400-e29b-41d4-a716-446655440000"
  sensor_id: string;             // "sensor-001" | "sensor-002" | "sensor-003" | "sensor-004"
  timestamp: Date;               // ISO 8601: 2024-01-15T14:30:22.123Z
  speed_kmh: number;             // Vehicle speed: 0.0-150.0 km/h
  length_dm: number;             // Vehicle length: 15-220 decimeters
  vehicle_class: string;         // "passenger_car" | "suv" | "pickup_truck" | "motorcycle" | "bus" | "semi_truck" | "delivery_van"
  occupancy_s: number;           // Sensor occupation time: 0.1-5.0 seconds
  time_gap_s: number;            // Gap to previous vehicle: 0.5-15.0 seconds
  status: number;                // Bit flags: 0x04=hw_fault, 0x08=low_voltage, 0x10=wrong_way, 0x20=queue_detected
  counter: number;               // Sequential message counter per sensor
  
  // === Enhanced Consumer Metadata ===
  received_at: Date;             // When document was stored
  schema_version: string;        // "1.0"
  _enhanced: boolean;            // Always false for vehicle records
  _processing_timestamp: Date;   // Processing timestamp
  
  // === Geo-Spatial Index (Optional) ===
  location?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude] if available
  };
}
```

### Indexed Fields

```javascript
// Primary indices
{ timestamp: 1 }              // Time-series queries
{ sensor_id: 1 }              // Filter by sensor
{ vehicle_class: 1 }          // Filter by vehicle type
{ speed_kmh: 1 }              // Speed range queries
{ counter: 1 }                // Sequence verification

// Compound indices for complex queries
{ sensor_id: 1, timestamp: -1 }     // Latest vehicles per sensor
{ vehicle_class: 1, speed_kmh: -1 } // Fast vehicles by type
{ timestamp: 1, status: 1 }         // Status events over time

// Geo-spatial index (if location available)
{ location: "2dsphere" }      // Geo-spatial queries
```

### Status Byte Decoding

```javascript
function decodeVehicleStatus(status) {
  return {
    hardware_fault: (status & 0x04) !== 0,
    low_voltage: (status & 0x08) !== 0,
    wrong_way_driver: (status & 0x10) !== 0,
    queue_detected: (status & 0x20) !== 0
  };
}
```

### Vehicle Length Specifications

```javascript
const VEHICLE_LENGTHS = {
  passenger_car: "30-45 dm",    // 3.0-4.5 meters
  suv: "45-55 dm",              // 4.5-5.5 meters  
  pickup_truck: "50-65 dm",     // 5.0-6.5 meters
  motorcycle: "15-25 dm",       // 1.5-2.5 meters
  bus: "100-140 dm",            // 10.0-14.0 meters
  semi_truck: "150-220 dm",     // 15.0-22.0 meters
  delivery_van: "55-75 dm"      // 5.5-7.5 meters
};
```

### Example Document

```json
{
  "_id": ObjectId("..."),
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "sensor_id": "sensor-001",
  "timestamp": ISODate("2024-01-15T14:30:22.123Z"),
  "speed_kmh": 45.2,
  "length_dm": 42,
  "vehicle_class": "passenger_car",
  "occupancy_s": 1.2,
  "time_gap_s": 3.5,
  "status": 0,
  "counter": 1547,
  "received_at": ISODate("2024-01-15T14:30:22.145Z"),
  "schema_version": "1.0",
  "_enhanced": false,
  "_processing_timestamp": ISODate("2024-01-15T14:30:22.144Z")
}
```

### Backend Query Examples

```javascript
// Get latest vehicles from specific sensor
const latestVehicles = await db.collection('vehicle_records')
  .find({ sensor_id: "sensor-001" })
  .sort({ timestamp: -1 })
  .limit(50);

// Count vehicles by class in time range
const vehicleCounts = await db.collection('vehicle_records').aggregate([
  { $match: { 
      timestamp: { 
        $gte: new Date('2024-01-15T14:00:00Z'),
        $lt: new Date('2024-01-15T15:00:00Z')
      }
    }
  },
  { $group: { 
      _id: "$vehicle_class", 
      count: { $sum: 1 },
      avgSpeed: { $avg: "$speed_kmh" }
    }
  }
]);

// Detect speed violations (>80 km/h)
const speedViolations = await db.collection('vehicle_records')
  .find({ 
    speed_kmh: { $gt: 80 },
    timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
  })
  .sort({ speed_kmh: -1 });
```

---

## 📊 Collection 2: `traffic_metrics` (🚀 ENHANCED)

**Source**: `traffic-data` Kafka topic  
**Purpose**: Aggregated traffic statistics with intersection coordination  
**Schema Version**: 2.0 (Enhanced with intersection controller fields)  
**Expected Volume**: ~50-200 documents/minute per sensor

### Document Schema

```typescript
interface TrafficMetrics {
  // === Core Traffic Data ===
  sensor_id: string;                    // "sensor-001" | "sensor-002" | "sensor-003" | "sensor-004"
  timestamp: Date;                      // ISO 8601 format
  location_id: string;                  // "bd-zerktouni-n" | "bd-zerktouni-s" | "bd-anfa-e" | "bd-anfa-w"
  location_x: number;                   // GPS longitude: -7.6363 to -7.6356
  location_y: number;                   // GPS latitude: 33.5907 to 33.5912
  
  // === Traffic Metrics ===
  density: number;                      // Traffic density percentage: 0-100
  travel_time: number;                  // Average travel time in seconds: 5-60
  vehicle_number: number;               // Current vehicle count in sensor zone
  speed: number;                        // Average speed in km/h: 5-80
  direction_change: string;             // "left" | "right" | "none"
  
  // === Vehicle Composition ===
  pedestrian_count: number;             // Pedestrians detected: 0-50
  bicycle_count: number;                // Bicycles detected: 0-20
  heavy_vehicle_count: number;          // Trucks + buses count
  vehicle_type_distribution: {
    cars: number;                       // Passenger cars count
    buses: number;                      // Bus count: 0-10
    motorcycles: number;                // Motorcycle count
    trucks: number;                     // Truck count: 0-15
  };
  
  // === Environmental Data ===
  visibility: string;                   // "good" | "fair" | "poor"
  weather_conditions: string;           // "sunny" | "rain" | "snow" | "fog"
  road_condition: string;               // "dry" | "wet" | "icy"
  temperature: number;                  // Temperature in Celsius: -10.0 to 35.0
  humidity: number;                     // Humidity percentage: 0-100
  wind_speed: number;                   // Wind speed in km/h: 0-40
  air_quality_index: number;            // AQI: 0-500
  
  // === Traffic Patterns ===
  congestion_level: string;             // "low" | "medium" | "high"
  average_vehicle_size: string;         // "small" | "medium" | "large"
  traffic_flow_direction: string;       // "north-south" | "east-west" | "both"
  
  // === Safety & Violations ===
  incident_detected: boolean;           // Accident or incident detected
  red_light_violations: number;         // Red light violations count: 0-5
  near_miss_events: number;             // Near miss incidents: 0-5
  accident_severity: string;            // "none" | "minor" | "major"
  roadwork_detected: boolean;           // Construction activity detected
  illegal_parking_cases: number;        // Illegal parking violations: 0-10
  
  // === 🚀 NEW INTERSECTION CONTROLLER FIELDS ===
  intersection_id?: string;             // "bd-anfa-bd-zerktouni" (only in enhanced mode)
  sensor_direction?: string;            // "north" | "south" | "east" | "west" (enhanced)
  coordinated_weather?: WeatherState;   // Synchronized weather across intersection
  traffic_light_phase?: string;        // "green" | "yellow" | "red" (coordinated)
  vehicle_flow_rate?: number;           // Vehicles per minute flowing through: 0-120
  queue_propagation_factor?: number;    // Congestion spread factor: 0.0-1.0
  
  // === Enhanced Consumer Metadata ===
  received_at: Date;                    // When document was stored
  schema_version: string;               // "1.0" | "2.0"
  _enhanced: boolean;                   // True if contains intersection coordination
  _processing_timestamp: Date;          // Processing timestamp
  
  // === Geo-Spatial Index ===
  location?: {
    type: "Point";
    coordinates: [number, number];      // [longitude, latitude]
  };
  
  // === Intersection Index (Enhanced Mode Only) ===
  intersection_index?: {
    id: string;                         // intersection_id
    sensor_direction: string | null;    // Mapped from traffic data
    coordination_timestamp: Date;       // timestamp
    enhanced_features: string[];        // ["weather_sync", "flow_tracking", etc.]
  };
}

// WeatherState schema (embedded in coordinated_weather)
interface WeatherState {
  conditions: string;          // "sunny" | "rain" | "snow" | "fog"
  temperature: number;         // Celsius: -10.0 to 35.0
  humidity: number;            // Percentage: 0-100
  wind_speed: number;          // km/h: 0-40
  visibility: string;          // "good" | "fair" | "poor"
  road_condition: string;      // "dry" | "wet" | "icy"
}
```

### Enhanced Indexed Fields

```javascript
// Base indices (same as legacy)
{ timestamp: 1 }
{ received_at: 1 }
{ schema_version: 1 }
{ _enhanced: 1 }

// Enhanced intersection-specific indices
{ "intersection_index.id": 1 }
{ "intersection_index.sensor_direction": 1 }
{ "intersection_index.coordination_timestamp": 1 }
{ "intersection_index.enhanced_features": 1 }

// Traffic-specific enhanced indices
{ intersection_id: 1 }
{ sensor_direction: 1 }
{ "coordinated_weather.conditions": 1 }
{ "coordinated_weather.temperature": 1 }
{ "coordinated_weather.road_condition": 1 }
{ vehicle_flow_rate: 1 }
{ queue_propagation_factor: 1 }
{ traffic_light_phase: 1 }

// Compound indices for complex queries
{ intersection_id: 1, sensor_direction: 1, timestamp: -1 }
{ intersection_id: 1, vehicle_flow_rate: -1 }
{ congestion_level: 1, timestamp: -1 }
{ weather_conditions: 1, road_condition: 1 }
```

### Example Enhanced Document

```json
{
  "_id": ObjectId("..."),
  "sensor_id": "sensor-001",
  "timestamp": ISODate("2024-01-15T14:30:22.123Z"),
  "location_id": "bd-zerktouni-n",
  "location_x": -7.6360,
  "location_y": 33.5910,
  "density": 45,
  "travel_time": 25,
  "vehicle_number": 12,
  "speed": 35,
  "direction_change": "none",
  "pedestrian_count": 3,
  "bicycle_count": 1,
  "heavy_vehicle_count": 2,
  "vehicle_type_distribution": {
    "cars": 8,
    "buses": 1,
    "motorcycles": 2,
    "trucks": 1
  },
  "visibility": "good",
  "weather_conditions": "sunny",
  "road_condition": "dry",
  "temperature": 22.5,
  "humidity": 65,
  "wind_speed": 15,
  "air_quality_index": 85,
  "congestion_level": "medium",
  "average_vehicle_size": "medium",
  "traffic_flow_direction": "north-south",
  "incident_detected": false,
  "red_light_violations": 0,
  "near_miss_events": 0,
  "accident_severity": "none",
  "roadwork_detected": false,
  "illegal_parking_cases": 0,
  
  // 🚀 ENHANCED FIELDS
  "intersection_id": "bd-anfa-bd-zerktouni",
  "sensor_direction": "north",
  "coordinated_weather": {
    "conditions": "sunny",
    "temperature": 22.5,
    "humidity": 65,
    "wind_speed": 15,
    "visibility": "good",
    "road_condition": "dry"
  },
  "traffic_light_phase": "green",
  "vehicle_flow_rate": 42.5,
  "queue_propagation_factor": 0.3,
  
  "received_at": ISODate("2024-01-15T14:30:22.145Z"),
  "schema_version": "2.0",
  "_enhanced": true,
  "_processing_timestamp": ISODate("2024-01-15T14:30:22.144Z"),
  
  "location": {
    "type": "Point",
    "coordinates": [-7.6360, 33.5910]
  },
  
  "intersection_index": {
    "id": "bd-anfa-bd-zerktouni",
    "sensor_direction": "north",
    "coordination_timestamp": ISODate("2024-01-15T14:30:22.123Z"),
    "enhanced_features": ["weather_sync", "flow_tracking", "light_coordination"]
  }
}
```

### Backend Query Examples

```javascript
// Get intersection coordination status
const intersectionStatus = await db.collection('traffic_metrics').aggregate([
  { $match: { 
      intersection_id: "bd-anfa-bd-zerktouni",
      _enhanced: true,
      timestamp: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
    }
  },
  { $group: {
      _id: "$sensor_direction",
      latestData: { $last: "$$ROOT" },
      avgFlowRate: { $avg: "$vehicle_flow_rate" },
      currentWeather: { $last: "$coordinated_weather" }
    }
  },
  { $sort: { "_id": 1 } }
]);

// Weather synchronization check across intersection
const weatherSync = await db.collection('traffic_metrics')
  .find({ 
    intersection_id: "bd-anfa-bd-zerktouni",
    "coordinated_weather": { $exists: true },
    timestamp: { $gte: new Date(Date.now() - 600000) } // Last 10 minutes
  })
  .sort({ timestamp: -1 })
  .limit(4); // One from each sensor

// Traffic flow analytics
const flowAnalytics = await db.collection('traffic_metrics').aggregate([
  { $match: { 
      intersection_id: "bd-anfa-bd-zerktouni",
      vehicle_flow_rate: { $exists: true },
      timestamp: { 
        $gte: new Date(Date.now() - 3600000) // Last hour
      }
    }
  },
  { $group: {
      _id: {
        sensor_direction: "$sensor_direction",
        hour: { $dateToString: { format: "%Y-%m-%d %H", date: "$timestamp" } }
      },
      avgFlowRate: { $avg: "$vehicle_flow_rate" },
      maxFlowRate: { $max: "$vehicle_flow_rate" },
      avgCongestion: { $avg: { $cond: [
        { $eq: ["$congestion_level", "high"] }, 3,
        { $cond: [{ $eq: ["$congestion_level", "medium"] }, 2, 1] }
      ]}},
      count: { $sum: 1 }
    }
  },
  { $sort: { "_id.hour": -1, "_id.sensor_direction": 1 } }
]);
```

---

## 🚦 Collection 3: `intersections` (🚀 ENHANCED)

**Source**: `intersection-data` Kafka topic  
**Purpose**: Intersection-wide coordination and efficiency metrics  
**Schema Version**: 2.0 (Enhanced with coordination fields)  
**Expected Volume**: ~20-100 documents/minute per sensor

### Document Schema

```typescript
interface IntersectionData {
  // === Basic Info ===
  sensor_id: string;                        // Source sensor ID
  timestamp: Date;                          // ISO 8601 format
  intersection_id: string;                  // "bd-anfa-bd-zerktouni"
  
  // === Queue Management ===
  stopped_vehicles_count: number;           // Total stopped vehicles: 0-60
  average_wait_time: number;                // Average wait time in seconds: 5-120
  queue_length_by_lane: {
    lane1: number;                          // Queue length lane 1: 0-25
    lane2: number;                          // Queue length lane 2: 0-25
    lane3: number;                          // Queue length lane 3: 0-25
  };
  
  // === Traffic Flow ===
  left_turn_count: number;                  // Left turns in period: 0-30
  right_turn_count: number;                 // Right turns in period: 0-30
  average_speed_by_direction: {
    north_south: number;                    // N-S average speed km/h: 20-60
    east_west: number;                      // E-W average speed km/h: 20-60
  };
  lane_occupancy: number;                   // Lane occupancy percentage: 0-100
  
  // === Safety Metrics ===
  intersection_blocking_vehicles: number;   // Vehicles blocking intersection: 0-5
  traffic_light_compliance_rate: number;    // Compliance percentage: 70-100
  risky_behavior_detected: boolean;         // Aggressive driving detected
  near_miss_incidents: number;              // Near miss count: 0-5
  collision_count: number;                  // Collision count: 0-3
  sudden_braking_events: number;            // Hard braking events: 0-10
  wrong_way_vehicles: number;               // Wrong-way drivers: 0-1
  illegal_parking_detected: boolean;        // Illegal parking in intersection
  
  // === Pedestrian Activity ===
  pedestrians_crossing: number;             // Pedestrians crossing: 0-40
  jaywalking_pedestrians: number;           // Jaywalking incidents
  cyclists_crossing: number;                // Cyclists crossing: 0-15
  
  // === Environmental ===
  ambient_light_level: number;              // Light level: 0-200
  local_weather_conditions: string;         // Weather at intersection
  fog_or_smoke_detected: boolean;           // Visibility obstruction
  
  // === Performance ===
  intersection_congestion_level: string;    // "low" | "medium" | "high"
  intersection_crossing_time: number;       // Time to cross intersection: 10-120s
  traffic_light_impact: string;             // "low" | "moderate" | "high"
  traffic_light_status: string;             // Current light status for this sensor
  
  // === 🚀 NEW COORDINATION FIELDS ===
  coordinated_light_status?: string;        // "north_south_green" | "east_west_green"
  phase_time_remaining?: number;            // Seconds until next phase: 0-90
  intersection_efficiency?: number;         // Throughput efficiency: 0.0-1.0
  total_intersection_vehicles?: number;     // Vehicle count across all 4 sensors
  
  // === Enhanced Consumer Metadata ===
  received_at: Date;                        // When document was stored
  schema_version: string;                   // "1.0" | "2.0"
  _enhanced: boolean;                       // True if contains coordination fields
  _processing_timestamp: Date;              // Processing timestamp
  
  // === Intersection Index (Enhanced Mode Only) ===
  intersection_index?: {
    id: string;                             // intersection_id
    sensor_direction: string | null;        // Mapped from sensor data
    coordination_timestamp: Date;           // timestamp
    enhanced_features: string[];            // ["light_coordination", "efficiency_monitoring"]
  };
}
```

### Enhanced Indexed Fields

```javascript
// Base indices
{ timestamp: 1 }
{ received_at: 1 }
{ schema_version: 1 }
{ _enhanced: 1 }

// Intersection-specific indices
{ intersection_id: 1 }
{ coordinated_light_status: 1 }
{ intersection_efficiency: 1 }
{ total_intersection_vehicles: 1 }
{ phase_time_remaining: 1 }

// Performance indices
{ intersection_congestion_level: 1 }
{ intersection_crossing_time: 1 }
{ traffic_light_compliance_rate: 1 }

// Safety indices
{ collision_count: 1 }
{ near_miss_incidents: 1 }
{ risky_behavior_detected: 1 }

// Compound indices for intersection analytics
{ intersection_id: 1, timestamp: -1 }
{ intersection_id: 1, intersection_efficiency: -1 }
{ coordinated_light_status: 1, timestamp: -1 }
{ intersection_id: 1, coordinated_light_status: 1, timestamp: -1 }
```

### Example Enhanced Document

```json
{
  "_id": ObjectId("..."),
  "sensor_id": "sensor-001",
  "timestamp": ISODate("2024-01-15T14:30:22.123Z"),
  "intersection_id": "bd-anfa-bd-zerktouni",
  
  "stopped_vehicles_count": 8,
  "average_wait_time": 35,
  "queue_length_by_lane": {
    "lane1": 4,
    "lane2": 3,
    "lane3": 1
  },
  
  "left_turn_count": 5,
  "right_turn_count": 8,
  "average_speed_by_direction": {
    "north_south": 25,
    "east_west": 30
  },
  "lane_occupancy": 65,
  
  "intersection_blocking_vehicles": 1,
  "traffic_light_compliance_rate": 95,
  "risky_behavior_detected": false,
  "near_miss_incidents": 0,
  "collision_count": 0,
  "sudden_braking_events": 2,
  "wrong_way_vehicles": 0,
  "illegal_parking_detected": false,
  
  "pedestrians_crossing": 12,
  "jaywalking_pedestrians": 1,
  "cyclists_crossing": 3,
  
  "ambient_light_level": 150,
  "local_weather_conditions": "sunny",
  "fog_or_smoke_detected": false,
  
  "intersection_congestion_level": "medium",
  "intersection_crossing_time": 45,
  "traffic_light_impact": "moderate",
  "traffic_light_status": "green",
  
  // 🚀 ENHANCED FIELDS
  "coordinated_light_status": "north_south_green",
  "phase_time_remaining": 25,
  "intersection_efficiency": 0.78,
  "total_intersection_vehicles": 34,
  
  "received_at": ISODate("2024-01-15T14:30:22.145Z"),
  "schema_version": "2.0",
  "_enhanced": true,
  "_processing_timestamp": ISODate("2024-01-15T14:30:22.144Z"),
  
  "intersection_index": {
    "id": "bd-anfa-bd-zerktouni",
    "sensor_direction": null,
    "coordination_timestamp": ISODate("2024-01-15T14:30:22.123Z"),
    "enhanced_features": ["light_coordination", "efficiency_monitoring"]
  }
}
```

### Backend Query Examples

```javascript
// Get intersection coordination dashboard
const intersectionDashboard = await db.collection('intersections').aggregate([
  { $match: { 
      intersection_id: "bd-anfa-bd-zerktouni",
      coordinated_light_status: { $exists: true },
      timestamp: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
    }
  },
  { $sort: { timestamp: -1 } },
  { $limit: 1 },
  { $project: {
      intersection_id: 1,
      coordinated_light_status: 1,
      phase_time_remaining: 1,
      intersection_efficiency: 1,
      total_intersection_vehicles: 1,
      intersection_congestion_level: 1,
      timestamp: 1
    }
  }
]);

// Intersection efficiency trends
const efficiencyTrends = await db.collection('intersections').aggregate([
  { $match: { 
      intersection_id: "bd-anfa-bd-zerktouni",
      intersection_efficiency: { $exists: true },
      timestamp: { 
        $gte: new Date(Date.now() - 86400000) // Last 24 hours
      }
    }
  },
  { $group: {
      _id: {
        hour: { $dateToString: { format: "%Y-%m-%d %H", date: "$timestamp" } }
      },
      avgEfficiency: { $avg: "$intersection_efficiency" },
      maxEfficiency: { $max: "$intersection_efficiency" },
      minEfficiency: { $min: "$intersection_efficiency" },
      avgVehicles: { $avg: "$total_intersection_vehicles" },
      totalSafetyIncidents: { $sum: "$near_miss_incidents" }
    }
  },
  { $sort: { "_id.hour": -1 } }
]);

// Light phase analysis
const lightPhaseAnalysis = await db.collection('intersections')
  .find({ 
    intersection_id: "bd-anfa-bd-zerktouni",
    coordinated_light_status: { $exists: true },
    timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
  })
  .sort({ timestamp: 1 });
```

---

## 🔧 Collection 4: `sensor_health`

**Source**: `sensor-health` Kafka topic  
**Purpose**: Sensor hardware diagnostics and health monitoring  
**Schema Version**: 1.0 (Legacy compatible)  
**Expected Volume**: ~5-20 documents/minute per sensor

### Document Schema

```typescript
interface SensorHealth {
  // === Core Health Data ===
  sensor_id: string;           // "sensor-001" | "sensor-002" | "sensor-003" | "sensor-004"
  timestamp: Date;             // ISO 8601 format
  battery_level: number;       // Battery percentage: 0-100
  temperature_c: number;       // Sensor temperature in Celsius: -20 to 60
  hw_fault: boolean;           // Hardware fault detected
  low_voltage: boolean;        // Low voltage warning
  uptime_s: number;            // Uptime in seconds since start
  message_count: number;       // Total messages sent by sensor
  
  // === Enhanced Consumer Metadata ===
  received_at: Date;           // When document was stored
  schema_version: string;      // "1.0"
  _enhanced: boolean;          // Always false for sensor health
  _processing_timestamp: Date; // Processing timestamp
}
```

### Indexed Fields

```javascript
// Primary indices
{ sensor_id: 1 }              // Filter by sensor
{ hw_fault: 1 }               // Find faulty sensors
{ low_voltage: 1 }            // Find low voltage sensors
{ timestamp: -1 }             // Latest health data

// Compound indices
{ sensor_id: 1, timestamp: -1 }    // Latest health per sensor
{ hw_fault: 1, timestamp: -1 }     // Recent faults
{ battery_level: 1, timestamp: -1 } // Battery trends
```

### Example Document

```json
{
  "_id": ObjectId("..."),
  "sensor_id": "sensor-001",
  "timestamp": ISODate("2024-01-15T14:30:22.123Z"),
  "battery_level": 87.5,
  "temperature_c": 24.3,
  "hw_fault": false,
  "low_voltage": false,
  "uptime_s": 259200,
  "message_count": 15847,
  "received_at": ISODate("2024-01-15T14:30:22.145Z"),
  "schema_version": "1.0",
  "_enhanced": false,
  "_processing_timestamp": ISODate("2024-01-15T14:30:22.144Z")
}
```

---

## 🚨 Collection 5: `alerts`

**Source**: `traffic-alerts` Kafka topic  
**Purpose**: Real-time safety and violation alerts  
**Schema Version**: 1.0 (Legacy compatible)  
**Expected Volume**: ~5-50 documents/minute per sensor

### Document Schema

```typescript
interface TrafficAlert {
  // === Core Alert Data ===
  type: string;                // "wrong-way-driver" | "traffic-queue" | "speed-violation" | "collision"
  timestamp: Date;             // ISO 8601 format
  sensor_id: string;           // Source sensor
  vehicle_data: {              // Associated vehicle information
    id: string;
    speed_kmh: number;
    vehicle_class: string;
    // ... other vehicle fields as available
  };
  
  // === Enhanced Consumer Metadata ===
  received_at: Date;           // When document was stored
  schema_version: string;      // "1.0"
  _enhanced: boolean;          // Always false for alerts
  _processing_timestamp: Date; // Processing timestamp
}
```

---

## 🗂️ Collection 6: `sensors` (Registry)

**Source**: Enhanced Consumer sensor registration  
**Purpose**: Comprehensive sensor registry with capabilities  
**Schema Version**: 2.0 (Enhanced consumer generated)  
**Expected Volume**: ~4-100 documents (static registry)

### Document Schema

```typescript
interface SensorRegistry {
  // === Basic Sensor Info ===
  sensor_id: string;                // Primary key: "sensor-001"
  sensor_type: string;              // "vehicle_detector" | "traffic_monitor" | "intersection_controller"
  message_topics: string[];         // Topics this sensor publishes to
  
  // === Location Data ===
  location_id?: string;             // "bd-zerktouni-n" | "bd-anfa-e"
  location_x?: number;              // GPS longitude
  location_y?: number;              // GPS latitude
  location?: {                      // Geo-spatial index
    type: "Point";
    coordinates: [number, number];
  };
  
  // === Intersection Association ===
  intersection_id?: string;         // "bd-anfa-bd-zerktouni"
  sensor_direction?: string;        // "north" | "south" | "east" | "west"
  
  // === Capabilities ===
  capabilities: string[];           // ["weather_monitoring", "flow_tracking", "intersection_monitoring"]
  
  // === Activity Tracking ===
  first_seen: Date;                 // When sensor was first registered
  last_seen: Date;                  // Last activity
  last_message_topic: string;       // Last message type
  message_count: number;            // Current session message count
  total_messages: number;           // Total messages ever sent
  created_at: Date;                 // Registration timestamp
}
```

### Sensor Registry Indexed Fields

```javascript
// Primary indices
{ sensor_id: 1 }              // Unique sensor ID
{ sensor_type: 1 }            // Filter by sensor type
{ intersection_id: 1 }        // Group by intersection
{ location_id: 1 }            // Group by location
{ sensor_direction: 1 }       // Filter by direction
{ capabilities: 1 }           // Filter by capabilities

// Activity indices
{ first_seen: 1 }             // Sort by registration date
{ last_seen: -1 }             // Sort by activity
{ "location": "2dsphere" }    // Geo-spatial queries

// Compound indices
{ intersection_id: 1, sensor_direction: 1 }
{ sensor_type: 1, capabilities: 1 }
{ location_id: 1, sensor_type: 1 }
```

---

## 🛠️ Backend Integration Patterns

### 1. Enhanced vs Legacy Detection

```javascript
// Detect enhanced data in your backend endpoints
async function processTrafficData(req, res) {
  const data = req.body;
  
  // Check if this is enhanced data with intersection coordination
  const isEnhanced = data.intersection_id && (
    data.coordinated_weather || 
    data.coordinated_light_status ||
    data.vehicle_flow_rate !== undefined ||
    data.sensor_direction
  );
  
  if (isEnhanced) {
    console.log(`🌟 Enhanced traffic data from intersection ${data.intersection_id}`);
    await handleIntersectionCoordination(data);
  } else {
    console.log(`📊 Legacy traffic data (backwards compatible)`);
  }
  
  await storeInMongoDB('traffic_metrics', data);
  res.json({ success: true, enhanced: isEnhanced });
}
```

### 2. Intersection Coordination Queries

```javascript
// Get real-time intersection status
async function getIntersectionStatus(intersectionId) {
  const trafficData = await db.collection('traffic_metrics')
    .find({ 
      intersection_id: intersectionId,
      _enhanced: true,
      timestamp: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
    })
    .sort({ timestamp: -1 })
    .limit(4) // One from each sensor
    .toArray();
    
  const intersectionData = await db.collection('intersections')
    .findOne({ 
      intersection_id: intersectionId,
      coordinated_light_status: { $exists: true }
    }, { sort: { timestamp: -1 } });
    
  return {
    traffic: trafficData,
    coordination: intersectionData,
    weatherSync: trafficData.length > 0 ? trafficData[0].coordinated_weather : null
  };
}
```

### 3. Historical Analytics Aggregations

```javascript
// Traffic flow analytics with intersection coordination
async function getTrafficFlowAnalytics(intersectionId, timeRange) {
  return await db.collection('traffic_metrics').aggregate([
    { $match: { 
        intersection_id: intersectionId,
        vehicle_flow_rate: { $exists: true },
        timestamp: { 
          $gte: new Date(Date.now() - timeRange)
        }
      }
    },
    { $group: {
        _id: {
          sensor_direction: "$sensor_direction",
          interval: { 
            $dateToString: { 
              format: "%Y-%m-%d %H:%M",
              date: {
                $dateTrunc: {
                  date: "$timestamp",
                  unit: "minute",
                  binSize: 15
                }
              }
            }
          }
        },
        avgFlowRate: { $avg: "$vehicle_flow_rate" },
        maxFlowRate: { $max: "$vehicle_flow_rate" },
        avgDensity: { $avg: "$density" },
        weatherConditions: { $last: "$coordinated_weather.conditions" },
        lightPhase: { $last: "$traffic_light_phase" }
      }
    },
    { $sort: { "_id.interval": -1, "_id.sensor_direction": 1 } }
  ]).toArray();
}
```

### 4. Sensor Health Monitoring

```javascript
// Monitor sensor health across intersection
async function getSensorHealthSummary() {
  return await db.collection('sensor_health').aggregate([
    { $sort: { timestamp: -1 } },
    { $group: {
        _id: "$sensor_id",
        latestHealth: { $first: "$$ROOT" }
      }
    },
    { $lookup: {
        from: "sensors",
        localField: "_id",
        foreignField: "sensor_id",
        as: "sensorInfo"
      }
    },
    { $project: {
        sensor_id: "$_id",
        battery_level: "$latestHealth.battery_level",
        hw_fault: "$latestHealth.hw_fault",
        low_voltage: "$latestHealth.low_voltage",
        uptime_s: "$latestHealth.uptime_s",
        intersection_id: { $arrayElemAt: ["$sensorInfo.intersection_id", 0] },
        sensor_direction: { $arrayElemAt: ["$sensorInfo.sensor_direction", 0] },
        last_seen: "$latestHealth.timestamp"
      }
    }
  ]).toArray();
}
```

---

## 📈 Performance Optimization Guidelines

### 1. Index Strategy
- **Time-series queries**: Always index by `timestamp` 
- **Real-time lookups**: Use compound indices `{intersection_id: 1, timestamp: -1}`
- **Geo-spatial queries**: Ensure `location: "2dsphere"` index exists
- **Aggregation pipelines**: Index on grouping fields first

### 2. Query Optimization
- **Limit time ranges**: Always use timestamp filters for large collections
- **Use projections**: Only fetch required fields
- **Leverage indices**: Order match conditions by index effectiveness
- **Pipeline optimization**: Push `$match` stages early in aggregations

### 3. Collection Maintenance
- **TTL indices**: Consider TTL on `vehicle_records` for automatic cleanup
- **Archival strategy**: Move old data to separate historical collections
- **Monitoring**: Track collection sizes and query performance
- **Sharding**: Consider sharding by `intersection_id` for horizontal scaling

---

## 🔍 Enhanced Consumer Behavioral Patterns

### 1. Schema Detection Logic

The enhanced consumer automatically detects whether incoming data contains intersection coordination fields:

```javascript
// Enhanced detection function from enhanced-consumer.js
function isIntersectionCoordinated(data) {
  return data.intersection_id && (
    data.coordinated_weather || 
    data.coordinated_light_status ||
    data.vehicle_flow_rate !== undefined ||
    data.sensor_direction ||
    data.traffic_light_phase ||
    data.queue_propagation_factor !== undefined ||
    data.intersection_efficiency !== undefined ||
    data.total_intersection_vehicles !== undefined ||
    data.phase_time_remaining !== undefined
  );
}
```

### 2. Sensor Direction Mapping Intelligence

**Critical for Backend Development**: The enhanced mongo consumer implements smart sensor direction mapping:

```javascript
// From enhanced-mongo-consumer.js - tracks sensor_id -> direction mapping
const sensorDirectionMap = new Map(); // sensor_id -> direction

// For traffic-data messages: Store the mapping
if (topic === "traffic-data" && data.sensor_id && data.sensor_direction) {
  sensorDirectionMap.set(data.sensor_id, data.sensor_direction);
}

// For intersection-data messages: Use stored direction if missing
if (topic === "intersection-data" && !data.sensor_direction && data.sensor_id) {
  const storedDirection = sensorDirectionMap.get(data.sensor_id);
  if (storedDirection) {
    document.sensor_direction = storedDirection;
  }
}
```

**Backend Implementation Tip**: Your API should implement similar logic to handle incomplete sensor direction data.

### 3. Enhanced Metadata Fields

Every document contains enhanced consumer metadata for debugging and monitoring:

```typescript
interface EnhancedMetadata {
  received_at: Date;             // When document was stored in MongoDB
  schema_version: "1.0" | "2.0"; // "1.0" = Legacy, "2.0" = Enhanced
  _enhanced: boolean;            // True if contains intersection coordination
  _processing_timestamp: Date;   // When enhanced consumer processed the message
  
  // From enhanced HTTP consumer
  _processed_by?: "enhanced-consumer";
  
  // HTTP headers from enhanced consumer
  headers?: {
    'X-Consumer-Type': 'enhanced';
    'X-Enhanced-Data': string; // "true" | "false"
  };
}
```

### 4. Collection Statistics Tracking

The enhanced mongo consumer tracks detailed statistics:

```javascript
// Statistics maintained by enhanced mongo consumer
{
  messageCount: 0,              // Total messages processed
  enhancedMessageCount: 0,      // Messages with intersection coordination
  legacyMessageCount: 0,        // Backwards compatible messages
  collectionStats: Map(),       // Per-collection enhanced/legacy counts
  sensorsRegistered: Set(),     // Cache of registered sensors
  sensorRegistrationCount: 0,   // New sensors discovered
  sensorDirectionMap: Map()     // sensor_id -> direction mappings
}
```

**Backend Query for Statistics**:
```javascript
// Get enhanced vs legacy distribution
const schemaDistribution = await db.collection('traffic_metrics').aggregate([
  { $group: {
      _id: "$schema_version",
      count: { $sum: 1 },
      enhanced_count: { $sum: { $cond: ["$_enhanced", 1, 0] } }
    }
  }
]);
```

---

## 🚨 Critical Backend Integration Patterns

### 1. Enhanced Data Validation

```javascript
// Validate enhanced data in your backend endpoints
function validateEnhancedTrafficData(data) {
  const validationResults = {
    isValid: true,
    errors: [],
    warnings: [],
    enhancements: []
  };
  
  // Check for intersection coordination completeness
  if (data.intersection_id) {
    if (!data.sensor_direction) {
      validationResults.warnings.push("Missing sensor_direction for intersection data");
    }
    
    if (data.coordinated_weather) {
      validationResults.enhancements.push("weather_sync");
    }
    
    if (data.vehicle_flow_rate !== undefined) {
      validationResults.enhancements.push("flow_tracking");
    }
    
    if (data.traffic_light_phase) {
      validationResults.enhancements.push("light_coordination");
    }
  }
  
  return validationResults;
}
```

### 2. Intersection State Management

```javascript
// Backend intersection state tracking (similar to enhanced consumer)
class IntersectionStateManager {
  constructor() {
    this.intersectionStates = new Map();
  }
  
  updateIntersectionState(data, topic) {
    const intersectionId = data.intersection_id;
    if (!intersectionId) return;
    
    if (!this.intersectionStates.has(intersectionId)) {
      this.intersectionStates.set(intersectionId, {
        sensors: new Set(),
        lastWeather: null,
        lastLightPhase: null,
        lastUpdate: null,
        messageCount: 0,
        sensorDirections: new Set()
      });
    }
    
    const state = this.intersectionStates.get(intersectionId);
    state.sensors.add(data.sensor_id);
    state.messageCount++;
    state.lastUpdate = new Date(data.timestamp);
    
    if (data.sensor_direction) {
      state.sensorDirections.add(data.sensor_direction);
    }
    
    if (data.coordinated_weather) {
      state.lastWeather = data.coordinated_weather;
    }
    
    if (data.coordinated_light_status || data.traffic_light_phase) {
      state.lastLightPhase = data.coordinated_light_status || data.traffic_light_phase;
    }
    
    return state;
  }
  
  getIntersectionSummary(intersectionId) {
    const state = this.intersectionStates.get(intersectionId);
    if (!state) return null;
    
    return {
      intersection_id: intersectionId,
      active_sensors: Array.from(state.sensors),
      sensor_directions: Array.from(state.sensorDirections),
      current_weather: state.lastWeather,
      current_light_phase: state.lastLightPhase,
      last_update: state.lastUpdate,
      message_count: state.messageCount,
      coordination_complete: state.sensorDirections.size >= 4
    };
  }
}
```

### 3. Real-time Coordination Endpoints

```javascript
// Enhanced backend endpoints for intersection coordination
app.post('/api/receive/coordination', async (req, res) => {
  try {
    const { intersection_id, coordination_state, message_type, enhanced_fields } = req.body;
    
    // Store coordination summary
    await db.collection('coordination_summaries').insertOne({
      intersection_id,
      coordination_state,
      source_message_type: message_type,
      enhanced_fields,
      timestamp: new Date(),
      active_sensors: coordination_state.sensors?.length || 0,
      sensor_directions: coordination_state.sensorDirections?.length || 0
    });
    
    // Broadcast to real-time clients
    io.to(`intersection-${intersection_id}`).emit('coordination-update', {
      intersection_id,
      state: coordination_state,
      enhanced_fields
    });
    
    res.json({ success: true, coordination: 'processed' });
  } catch (error) {
    console.error('Coordination processing error:', error);
    res.status(500).json({ error: 'Failed to process coordination data' });
  }
});

// Get intersection coordination status
app.get('/api/intersections/:id/coordination', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get latest traffic data from all sensors
    const trafficData = await db.collection('traffic_metrics').aggregate([
      { $match: { 
          intersection_id: id,
          _enhanced: true,
          timestamp: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
        }
      },
      { $group: {
          _id: "$sensor_direction",
          latestData: { $last: "$$ROOT" }
        }
      }
    ]).toArray();
    
    // Get latest intersection coordination
    const intersectionData = await db.collection('intersections')
      .findOne({ 
        intersection_id: id,
        coordinated_light_status: { $exists: true }
      }, { sort: { timestamp: -1 } });
    
    // Get coordination summary
    const coordinationSummary = await db.collection('coordination_summaries')
      .findOne({ intersection_id: id }, { sort: { timestamp: -1 } });
    
    res.json({
      intersection_id: id,
      traffic_sensors: trafficData,
      intersection_status: intersectionData,
      coordination_summary: coordinationSummary,
      weather_sync: trafficData.length > 0 ? trafficData[0].latestData?.coordinated_weather : null,
      coordination_complete: trafficData.length >= 4
    });
  } catch (error) {
    console.error('Intersection coordination query error:', error);
    res.status(500).json({ error: 'Failed to fetch intersection coordination' });
  }
});
```

### 4. Enhanced Error Handling

```javascript
// Enhanced error handling based on consumer patterns
app.use('/api/receive', (req, res, next) => {
  // Add enhanced consumer headers validation
  const isEnhancedConsumer = req.headers['x-consumer-type'] === 'enhanced';
  const hasEnhancedData = req.headers['x-enhanced-data'] === 'true';
  
  if (isEnhancedConsumer && hasEnhancedData) {
    req.enhancedMode = true;
    console.log(`🌟 Enhanced data received from enhanced consumer`);
  } else {
    req.enhancedMode = false;
    console.log(`📊 Legacy data received`);
  }
  
  next();
});

// Error handling for enhanced data processing
app.use((error, req, res, next) => {
  console.error('Enhanced data processing error:', error);
  
  if (req.enhancedMode) {
    // Enhanced error response with coordination context
    res.status(500).json({
      error: 'Enhanced data processing failed',
      enhanced_mode: true,
      intersection_coordination: req.body?.intersection_id || null,
      sensor_direction: req.body?.sensor_direction || null,
      enhanced_features: req.body?.intersection_id ? 
        ['weather_sync', 'flow_tracking', 'light_coordination'] : 
        ['legacy_mode'],
      timestamp: new Date().toISOString()
    });
  } else {
    // Standard error response
    res.status(500).json({
      error: 'Data processing failed',
      enhanced_mode: false,
      timestamp: new Date().toISOString()
    });
  }
});
```

This comprehensive documentation provides Big Daddy with all the essential information needed for seamless backend endpoint development with the enhanced traffic data MongoDB collections. The schema evolution supports both legacy and enhanced modes, ensuring backwards compatibility while enabling advanced intersection coordination features. 