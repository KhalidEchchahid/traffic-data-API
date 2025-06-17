# Core API Endpoints Documentation

## Overview

This document provides comprehensive documentation for the Traffic Monitoring API v2.0 core endpoints. The API provides real-time and historical traffic data with enhanced intersection coordination capabilities, vehicle analytics, and sensor management.

**Base URL**: `http://localhost:3001`  
**API Version**: 2.0  
**Enhanced Features**: ✅ Intersection Coordination, ✅ Weather Synchronization, ✅ Sensor Registry, ✅ Real-time Streaming

---

## 🚦 Traffic Data Endpoints

### GET `/api/traffic`

Retrieve traffic data with enhanced intersection coordination fields.

**Query Parameters:**
```typescript
interface TrafficQueryParams {
  page?: number;           // Page number (default: 1)
  limit?: number;          // Items per page (default: 50, max: 200)
  sensor_id?: string;      // Filter by specific sensor
  intersection_id?: string; // Filter by intersection (ENHANCED)
  sensor_direction?: string; // "north" | "south" | "east" | "west" (ENHANCED)
  start?: string;          // Start date (ISO string)
  end?: string;            // End date (ISO string)
  weather_condition?: string; // Filter by weather condition (ENHANCED)
  min_speed?: number;      // Minimum speed filter
  max_speed?: number;      // Maximum speed filter
  min_density?: number;    // Minimum density filter
  max_density?: number;    // Maximum density filter
  include_enhanced?: boolean; // Include enhanced fields (default: true)
}
```

**Response:**
```typescript
interface TrafficResponse {
  data: TrafficData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  enhancement_info: {
    enhanced_records: number;
    legacy_records: number;
    enhancement_rate: number; // 0.0 - 1.0
  };
}

interface TrafficData {
  // Core fields (always present)
  _id: string;
  sensor_id: string;
  timestamp: string;        // ISO string
  location_id: string;
  location_x: number;       // Longitude
  location_y: number;       // Latitude
  density: number;          // 0-100
  travel_time: number;      // seconds
  vehicle_number: number;
  speed: number;            // km/h
  congestion_level: string; // "low" | "medium" | "high" | "critical"
  
  // Enhanced fields (when available)
  intersection_id?: string;              // "bd-anfa-bd-zerktouni"
  sensor_direction?: string;             // "north" | "south" | "east" | "west"
  coordinated_weather?: WeatherState;    // Synchronized weather
  traffic_light_phase?: string;         // "green" | "yellow" | "red"
  vehicle_flow_rate?: number;           // vehicles/minute (0-120)
  queue_propagation_factor?: number;    // 0.0-1.0
  
  // Metadata
  received_at: string;
  schema_version: string;   // "1.0" | "2.0"
}

interface WeatherState {
  conditions: string;       // "sunny" | "rain" | "snow" | "fog"
  temperature: number;      // Celsius (-10.0 to 35.0)
  humidity: number;         // Percentage (0-100)
  wind_speed: number;       // km/h (0-40)
  visibility: string;       // "good" | "fair" | "poor"
  road_condition: string;   // "dry" | "wet" | "icy"
}
```

**Example Request:**
```bash
GET /api/traffic?intersection_id=bd-anfa-bd-zerktouni&limit=20&include_enhanced=true
```

**Example Response:**
```json
{
  "data": [
    {
      "_id": "65a1b2c3d4e5f6789",
      "sensor_id": "sensor-bd-anfa-north",
      "timestamp": "2024-01-15T14:30:25.123Z",
      "location_id": "bd-anfa-bd-zerktouni-north",
      "location_x": 33.5912,
      "location_y": -7.6356,
      "density": 65,
      "travel_time": 45,
      "vehicle_number": 23,
      "speed": 32.5,
      "congestion_level": "medium",
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
      "vehicle_flow_rate": 45.2,
      "queue_propagation_factor": 0.3,
      "received_at": "2024-01-15T14:30:26.000Z",
      "schema_version": "2.0"
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "limit": 20,
    "pages": 63
  },
  "enhancement_info": {
    "enhanced_records": 18,
    "legacy_records": 2,
    "enhancement_rate": 0.9
  }
}
```

### GET `/api/traffic/stream`

Real-time traffic data stream using Server-Sent Events (SSE).

**Query Parameters:**
```typescript
interface TrafficStreamParams {
  intersection_id?: string; // Filter by intersection
  sensor_direction?: string; // Filter by direction
}
```

**Response Stream:**
```typescript
interface TrafficStreamEvent {
  type: "TRAFFIC";
  data: TrafficData;
  timestamp: string;
  enhanced: boolean;
}
```

**Frontend Integration Example:**
```typescript
const eventSource = new EventSource('/api/traffic/stream?intersection_id=bd-anfa-bd-zerktouni');

eventSource.onmessage = (event) => {
  const update: TrafficStreamEvent = JSON.parse(event.data);
  setTrafficData(prev => ({
    ...prev,
    [update.data.sensor_direction]: update.data
  }));
};
```

---

## 🚗 Vehicle Data Endpoints

### GET `/api/vehicles`

Retrieve vehicle records with enhanced filtering and Rust simulator integration.

**Query Parameters:**
```typescript
interface VehicleQueryParams {
  page?: number;
  limit?: number;
  sensor_id?: string;
  intersection_id?: string;        // ENHANCED: Filter by intersection
  sensor_direction?: string;       // ENHANCED: Filter by direction
  vehicle_class?: string;          // Filter by vehicle type
  weather_condition?: string;      // ENHANCED: Filter by weather
  start?: string;
  end?: string;
  min_speed?: number;
  max_speed?: number;
  status_filter?: string[];        // Filter by status flags
}
```

**Response:**
```typescript
interface VehicleResponse {
  data: VehicleRecord[];
  pagination: PaginationInfo;
  enhancement_info: EnhancementInfo;
  specifications: VehicleSpecifications;
}

interface VehicleRecord {
  // Core fields
  _id: string;
  sensor_id: string;
  timestamp: string;
  location_id: string;
  location_x: number;
  location_y: number;
  vehicle_id: string;
  vehicle_class: string;            // "passenger_car" | "suv" | "pickup_truck" | "motorcycle" | "bus" | "semi_truck" | "delivery_van"
  length_dm: number;                // Decimeters (15-220)
  speed_kmh: number;
  status: number;                   // Status byte
  
  // Enhanced fields
  intersection_id?: string;
  sensor_direction?: string;
  coordinated_weather?: WeatherState;
  
  // Decoded status
  decoded_status: {
    hardware_fault: boolean;
    low_voltage: boolean;
    wrong_way_driver: boolean;
    queue_detected: boolean;
  };
}

interface VehicleSpecifications {
  vehicle_lengths: {
    passenger_car: string;    // "30-45 dm" (3.0-4.5m)
    suv: string;              // "45-55 dm" (4.5-5.5m)
    pickup_truck: string;     // "50-65 dm" (5.0-6.5m)
    motorcycle: string;       // "15-25 dm" (1.5-2.5m)
    bus: string;              // "100-140 dm" (10.0-14.0m)
    semi_truck: string;       // "150-220 dm" (15.0-22.0m)
    delivery_van: string;     // "55-75 dm" (5.5-7.5m)
  };
  status_byte_decoding: {
    hardware_fault: string;   // "0x04"
    low_voltage: string;      // "0x08"
    wrong_way_driver: string; // "0x10"
    queue_detected: string;   // "0x20"
  };
}
```

### GET `/api/vehicles/stats`

Enhanced vehicle statistics with intersection coordination and weather correlation.

**Query Parameters:**
```typescript
interface VehicleStatsParams {
  intersection_id?: string;
  time_window?: number;     // Minutes (default: 60)
  include_weather?: boolean; // Include weather correlation
  include_intersection?: boolean; // Include intersection breakdown
}
```

**Response:**
```typescript
interface VehicleStatsResponse {
  overall_stats: {
    total_vehicles: number;
    enhanced_records: number;
    enhancement_rate: number;
    avg_speed: number;
    avg_length: number;
    unique_sensors: number;
    time_range: {
      start: string;
      end: string;
    };
  };
  
  vehicle_class_breakdown: {
    class: string;
    count: number;
    percentage: number;
    avg_speed: number;
    avg_length: number;
  }[];
  
  intersection_analysis?: {
    intersection_id: string;
    direction_breakdown: {
      direction: string;
      count: number;
      avg_speed: number;
      unique_vehicles: number;
    }[];
    total_intersection_vehicles: number;
  }[];
  
  weather_correlation?: {
    condition: string;
    vehicle_count: number;
    avg_speed: number;
    avg_density: number;
    impact_analysis: string;
  }[];
  
  status_analysis: {
    total_faults: number;
    wrong_way_incidents: number;
    queue_detections: number;
    low_voltage_alerts: number;
  };
  
  data_source_breakdown: {
    enhanced: number;
    legacy: number;
    enhancement_rate: number;
  };
}
```

### GET `/api/vehicles/intersection/:intersectionId`

Intersection-specific vehicle analytics with 4-sensor breakdown.

**Path Parameters:**
- `intersectionId`: Intersection identifier

**Query Parameters:**
```typescript
interface IntersectionVehicleParams {
  timeWindow?: number;      // Minutes (default: 60)
  includeWeather?: boolean; // Include weather data
}
```

**Response:**
```typescript
interface IntersectionVehicleResponse {
  intersection_id: string;
  total_vehicles: number;
  
  direction_breakdown: {
    direction: string;        // "north" | "south" | "east" | "west"
    vehicle_count: number;
    avg_speed: number;
    vehicle_classes: {
      class: string;
      count: number;
    }[];
    recent_vehicles: VehicleRecord[];
  }[];
  
  weather_conditions?: WeatherState;
  
  enhanced_features: string[]; // ["intersection_coordination", "weather_sync"] or ["legacy_mode"]
  
  time_window: {
    start: string;
    end: string;
    minutes: number;
  };
  
  data_availability: {
    has_enhanced_data: boolean;
    data_sources: string[];
    recommendations: string[];
  };
}
```

### GET `/api/vehicles/intersection/:intersectionId/diagnostics`

Diagnostic information for intersection vehicle data availability.

**Response:**
```typescript
interface VehicleDiagnosticResponse {
  intersection_id: string;
  data_availability: {
    vehicle_records_available: boolean;
    traffic_metrics_available: boolean;
    enhanced_data_available: boolean;
  };
  
  collection_stats: {
    vehicle_records: {
      total_documents: number;
      recent_documents: number;
      sample_document?: VehicleRecord;
    };
    traffic_metrics: {
      total_documents: number;
      recent_documents: number;
      sample_document?: any;
    };
  };
  
  fuzzy_matches: {
    intersection_id: string;
    similarity_score: number;
  }[];
  
  available_intersections: string[];
  
  suggestions: string[];
  
  debug_info: {
    strategies_tried: string[];
    time_ranges_checked: string[];
    filters_applied: any;
  };
}
```

### GET `/api/vehicles/specifications`

Enhanced vehicle specifications from Rust simulator.

**Response:**
```typescript
interface VehicleSpecificationsResponse {
  enhanced_vehicle_lengths: {
    [key: string]: {
      min_dm: number;
      max_dm: number;
      min_meters: number;
      max_meters: number;
      description: string;
    };
  };
  
  status_byte_decoding: {
    [key: string]: {
      bit_mask: string;
      description: string;
      hex_value: string;
    };
  };
  
  vehicle_class_enumeration: string[];
  
  integration_metadata: {
    rust_simulator_version: string;
    enhanced_features: string[];
    schema_version: string;
  };
}
```

---

## 🏁 Intersection Endpoints

### GET `/api/intersections`

Retrieve intersection data with coordination capabilities.

**Query Parameters:**
```typescript
interface IntersectionQueryParams {
  page?: number;
  limit?: number;
  intersection_id?: string;
  has_coordination?: boolean; // Filter enhanced intersections
  min_efficiency?: number;    // Filter by efficiency score
  include_sensors?: boolean;  // Include sensor breakdown
}
```

**Response:**
```typescript
interface IntersectionResponse {
  data: IntersectionData[];
  pagination: PaginationInfo;
  coordination_summary: {
    total_intersections: number;
    coordinated_intersections: number;
    avg_efficiency: number;
  };
}

interface IntersectionData {
  // Core fields
  _id: string;
  sensor_id: string;
  timestamp: string;
  intersection_id: string;
  stopped_vehicles_count: number;
  average_wait_time: number;
  left_turn_count: number;
  right_turn_count: number;
  through_count: number;
  
  // Enhanced coordination fields
  coordinated_light_status?: string;   // "north_south_green" | "east_west_green"
  phase_time_remaining?: number;       // Seconds (0-90)
  intersection_efficiency?: number;    // 0.0-1.0
  total_intersection_vehicles?: number;
  
  // Sensor breakdown (when include_sensors=true)
  sensor_breakdown?: {
    direction: string;
    sensor_id: string;
    vehicle_count: number;
    avg_speed: number;
    status: string;
  }[];
}
```

### GET `/api/intersections/:id/coordination`

Real-time coordination status for specific intersection.

**Response:**
```typescript
interface CoordinationResponse {
  intersection_id: string;
  coordination_status: {
    is_coordinated: boolean;
    light_phase: string;
    phase_remaining: number;
    efficiency_score: number;
    total_vehicles: number;
  };
  
  sensor_status: {
    direction: string;
    sensor_id: string;
    active: boolean;
    last_update: string;
    vehicle_count: number;
    flow_rate: number;
  }[];
  
  weather_sync: WeatherState | null;
  
  last_update: string;
}
```

---

## 📡 Sensor Endpoints

### GET `/api/sensors/status`

Sensor status monitoring and health data (replaces non-existent `/sensors/health`).

**Response:**
```typescript
interface SensorStatusResponse {
  data: SensorStatusData[];
}

interface SensorStatusData {
  _id: string;
  sensor_id: string;
  timestamp: string;
  status: string;           // "healthy" | "warning" | "critical" | "offline"
  battery_level?: number;   // 0-100
  signal_strength?: number; // 0-100
  temperature_c?: number;   // Temperature in Celsius
  hw_fault?: boolean;       // Hardware fault flag
  low_voltage?: boolean;    // Low voltage flag
  uptime_s?: number;        // Uptime in seconds
  issues: string[];         // Array of issue descriptions
  last_maintenance?: string;
  error_codes?: string[];
}
```

**Example Response:**
```json
[
  {
    "_id": "65a1b2c3d4e5f6789",
    "sensor_id": "sensor-bd-anfa-north",
    "timestamp": "2024-01-15T14:30:25.123Z",
    "status": "healthy",
    "battery_level": 85,
    "temperature_c": 32.5,
    "hw_fault": false,
    "low_voltage": false,
    "uptime_s": 86400,
    "issues": []
  },
  {
    "_id": "65a1b2c3d4e5f6790",
    "sensor_id": "sensor-bd-anfa-south",
    "timestamp": "2024-01-15T14:30:20.456Z",
    "status": "warning",
    "battery_level": 15,
    "temperature_c": 42.1,
    "hw_fault": false,
    "low_voltage": true,
    "uptime_s": 75600,
    "issues": ["Low battery", "High temperature"]
  }
]
```

### GET `/api/sensors/registry`

Complete sensor registry with capabilities and enhanced features.

**Response:**
```typescript
interface SensorRegistryResponse {
  total_sensors: number;
  sensors: RegisteredSensor[];
}

interface RegisteredSensor {
  sensor_id: string;
  intersection_id?: string;
  sensor_direction?: string;        // "north" | "south" | "east" | "west"
  type: string;                    // "intersection" | "traffic" | "hybrid"
  enhanced_features: boolean;
  
  capabilities: {
    intersection_coordination?: boolean;
    weather_sync?: boolean;
    flow_rate_detection?: boolean;
    queue_propagation?: boolean;
    efficiency_metrics?: boolean;
    traffic_flow?: boolean;
    density_detection?: boolean;
    speed_detection?: boolean;
    incident_detection?: boolean;
    weather_monitoring?: boolean;
  };
  
  status: string;                  // "active" | "inactive"
  first_seen: string;
  last_seen: string;
  data_points: number;
}
```

### GET `/api/sensors/map`

Geo-spatial sensor map data for visualization with GeoJSON format.

**Response:**
```typescript
interface SensorMapResponse {
  type: "FeatureCollection";
  features: SensorMapFeature[];
  metadata: {
    total_sensors: number;
    sensors_with_direction: number;
    data_sources: {
      traffic_collection: number;
      intersection_collection: number;
    };
    debug: {
      collections_used: string[];
      coordinate_source: string;
    };
  };
}

interface SensorMapFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    sensor_id: string;
    intersection_id?: string;
    sensor_direction?: string;
    last_seen: string;
  };
}
```

### GET `/api/sensors/:id/capabilities`

Get detailed capabilities for a specific sensor.

**Path Parameters:**
- `id`: Sensor identifier

**Response:**
```typescript
interface SensorCapabilitiesResponse {
  sensor_id: string;
  enhanced_features: boolean;
  
  basic_capabilities: {
    traffic_flow: boolean;
    density_detection: boolean;
    speed_detection: boolean;
    incident_detection: boolean;
    weather_monitoring: boolean;
  };
  
  enhanced_capabilities?: {
    intersection_coordination: boolean;
    weather_synchronization: boolean;
    flow_rate_analysis: boolean;
    queue_propagation_tracking: boolean;
    efficiency_monitoring: boolean;
    directional_sensing: boolean;
    phase_timing: boolean;
  };
  
  coordination_data?: {
    intersection_id: string;
    sensor_direction: string;
    current_efficiency: number;
    last_update: string;
  };
}
```

### GET `/api/sensors/intersection/:id`

Get all sensors for a specific intersection with merged data from traffic and intersection collections.

**Path Parameters:**
- `id`: Intersection identifier

**Response:**
```typescript
interface IntersectionSensorsResponse {
  intersection_id: string;
  total_sensors: number;
  sensors: IntersectionSensor[];
  metadata: {
    sensors_with_direction: number;
    data_sources: {
      traffic_sensors: number;
      intersection_sensors: number;
    };
    debug: {
      collections_merged: string[];
      direction_inference_applied: boolean;
    };
  };
}

interface IntersectionSensor {
  _id: string;
  sensor_id: string;
  sensor_direction?: string;
  status: string;
  data_points: number;
  vehicle_flow_rate?: number;
  queue_propagation_factor?: number;
  intersection_efficiency?: number;
  coordinated_light_status?: string;
  traffic_flow_rate?: number;
  current_speed?: number;
  current_density?: number;
  last_update: string;
}
```

### GET `/api/sensors/history/:sensorId`

Get sensor health history for time-series analysis.

**Path Parameters:**
- `sensorId`: Sensor identifier

**Query Parameters:**
- `start`: Start date (ISO string)
- `end`: End date (ISO string)

**Response:**
```typescript
interface SensorHistoryResponse {
  batteryHistory: TimeSeriesPoint[];
  temperatureHistory: TimeSeriesPoint[];
  uptimeHistory: TimeSeriesPoint[];
  faultHistory: FaultHistoryPoint[];
}

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

interface FaultHistoryPoint {
  timestamp: string;
  hw_fault: boolean;
  low_voltage: boolean;
}
```

### GET `/api/sensors/stream`

Real-time sensor health data stream using Server-Sent Events.

**Response Stream:**
```typescript
interface SensorStreamEvent {
  type: "SENSOR";
  data: SensorStatusData;
  timestamp: string;
}
```

---

## ⚠️ Alert Endpoints

### GET `/api/alerts`

Traffic alerts with comprehensive filtering.

**Query Parameters:**
```typescript
interface AlertQueryParams {
  page?: number;
  limit?: number;
  type?: string;           // Alert type filter
  sensor_id?: string;
  severity?: string;       // "low" | "medium" | "high" | "critical"
  resolved?: boolean;
  start?: string;
  end?: string;
}
```

**Response:**
```typescript
interface AlertResponse {
  data: AlertData[];
  pagination: PaginationInfo;
}

interface AlertData {
  _id: string;
  sensor_id: string;
  timestamp: string;
  type: string;            // "congestion" | "accident" | "weather" | "sensor_fault"
  severity: string;        // "low" | "medium" | "high" | "critical"
  message: string;
  location_id: string;
  intersection_id?: string;
  resolved: boolean;
  resolution_time?: number; // Minutes
  resolution_message?: string;
  
  alert_details: {
    trigger_conditions: any;
    affected_area: {
      intersection_id?: string;
      sensor_ids: string[];
      estimated_impact_radius: number;
    };
    recommended_actions: string[];
  };
}
```

### GET `/api/alerts/stats`

Comprehensive alert statistics and analytics.

**Response:**
```typescript
interface AlertStatsResponse {
  total_alerts: number;
  recent_alerts_count: number;     // Last 24 hours
  high_priority_count: number;     // High/Critical severity
  
  alerts_by_type: {
    type: string;
    count: number;
  }[];
  
  alerts_by_severity: {
    severity: string;
    count: number;
  }[];
  
  alerts_by_sensor: {
    sensor_id: string;
    count: number;
  }[];
  
  resolved_status: {
    resolved: number;
    unresolved: number;
  };
  
  hourly_distribution: {
    hour: number;
    count: number;
  }[];
  
  average_resolution_time: number | null;
  total_resolved_alerts: number;
}
```

### GET `/api/alerts/count`

Alert count with advanced filtering.

**Query Parameters:** Same as `/api/alerts`

**Response:**
```typescript
interface AlertCountResponse {
  count: number;
  filters: {
    type: string | null;
    sensor_id: string | null;
    severity: string | null;
    resolved: boolean | null;
    time_range: {
      start: string | null;
      end: string | null;
    };
  };
}
```

### GET `/api/alerts/stream` ⚡ SSE

Real-time alert data stream using Server-Sent Events.

**Query Parameters:**
```typescript
interface AlertStreamParams {
  type?: string;           // Filter by alert type
  severity?: string;       // Filter by severity level
  sensor_id?: string;      // Filter by specific sensor
  intersection_id?: string; // Filter by intersection
}
```

**Response Stream:**
```typescript
interface AlertStreamEvent {
  type: 'ALERT';
  data: AlertData;
  timestamp: string;
}
```

**Frontend Integration Example:**
```typescript
const eventSource = new EventSource('/api/alerts/stream?severity=high,critical');

eventSource.onmessage = (event) => {
  const update: AlertStreamEvent = JSON.parse(event.data);
  // Handle real-time alert
  console.log('New alert:', update.data);
};
```

---

## 📥 Data Receiver Endpoints

These endpoints are used by Kafka consumers to ingest data into the system.

### POST `/api/receive/traffic`

Receive traffic data from Kafka consumers.

**Request Body:**
```typescript
interface TrafficDataIngestion extends TrafficData {
  // All TrafficData fields supported
}
```

**Response:**
```typescript
interface IngestionResponse {
  success: boolean;
  enhanced: boolean;
  features: string[];      // ["intersection_coordination", "weather_sync"] or ["legacy_mode"]
  timestamp: string;
}
```

### POST `/api/receive/vehicle`

Receive vehicle data from Kafka consumers.

### POST `/api/receive/intersection`

Receive intersection data from Kafka consumers.

### POST `/api/receive/sensor`

Receive sensor health data from Kafka consumers.

### POST `/api/receive/alert`

Receive traffic alerts from Kafka consumers.

### POST `/api/receive/coordination`

Receive coordination summaries from enhanced consumers.

---

## 🎯 Frontend Integration Patterns

### Real-time Data Updates

```typescript
// Traffic Data Stream
const useTrafficStream = (intersectionId?: string) => {
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/traffic/stream${intersectionId ? `?intersection_id=${intersectionId}` : ''}`
    );
    
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setTrafficData(prev => [...prev.slice(-99), update.data]);
    };
    
    return () => eventSource.close();
  }, [intersectionId]);
  
  return trafficData;
};
```

### Data Fetching Hooks

```typescript
// Vehicle Statistics Hook
const useVehicleStats = (intersection_id?: string) => {
  return useQuery({
    queryKey: ['vehicle-stats', intersection_id],
    queryFn: async () => {
      const params = intersection_id ? `?intersection_id=${intersection_id}` : '';
      const response = await fetch(`/api/vehicles/stats${params}`);
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });
};
```

### Error Handling

```typescript
interface ApiError {
  error: string;
  details?: string;
  collection?: string;
  suggestions?: string[];
}

const handleApiError = (error: ApiError) => {
  console.error('API Error:', error);
  // Display user-friendly error message
  toast.error(error.error);
};
```

---

## 📊 Response Format Standards

All API responses follow consistent patterns:

### Success Response
```typescript
interface SuccessResponse<T> {
  data: T;
  pagination?: PaginationInfo;
  metadata?: any;
  timestamp: string;
}
```

### Error Response
```typescript
interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
}
```

### Pagination Info
```typescript
interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

---

This documentation covers all core endpoints for building a comprehensive traffic monitoring dashboard. The next sections will cover advanced analytics and real-time integration features. 