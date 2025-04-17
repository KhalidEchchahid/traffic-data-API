// Types for the traffic data
export interface VehicleData {
  id: string;
  sensor_id: string;
  timestamp: string;
  speed_kmh: number;
  length_dm: number;
  vehicle_class: string;
  occupancy_s: number;
  time_gap_s: number;
  status: number;
  counter: number;
}

export interface TrafficAlert {
  sensor_id: string;
  timestamp: string;
  type: string;
  vehicle_data: VehicleData;
}

export interface QueueLengthByLane {
  [key: string]: number;
}

export interface AverageSpeedByDirection {
  [key: string]: number;
}

export interface IntersectionData {
  sensor_id: string;
  timestamp: string;
  intersection_id: string;
  stopped_vehicles_count: number;
  average_wait_time: number;
  left_turn_count: number;
  right_turn_count: number;
  average_speed_by_direction: AverageSpeedByDirection;
  lane_occupancy: number;
  intersection_blocking_vehicles: number;
  traffic_light_compliance_rate: number;
  pedestrians_crossing: number;
  jaywalking_pedestrians: number;
  cyclists_crossing: number;
  risky_behavior_detected: boolean;
  queue_length_by_lane: QueueLengthByLane;
  intersection_congestion_level: string;
  intersection_crossing_time: number;
  traffic_light_impact: string;
  near_miss_incidents: number;
  collision_count: number;
  sudden_braking_events: number;
  illegal_parking_detected: boolean;
  wrong_way_vehicles: number;
  ambient_light_level: number;
  traffic_light_status: string;
  local_weather_conditions: string;
  fog_or_smoke_detected: boolean;
}

export interface VehicleTypeDistribution {
  [key: string]: number;
}

export interface TrafficData {
  sensor_id: string;
  timestamp: string;
  location_id: string;
  location_x: number;
  location_y: number;
  density: number;
  travel_time: number;
  vehicle_number: number;
  speed: number;
  direction_change: string;
  pedestrian_count: number;
  bicycle_count: number;
  heavy_vehicle_count: number;
  incident_detected: boolean;
  visibility: string;
  weather_conditions: string;
  road_condition: string;
  congestion_level: string;
  average_vehicle_size: string;
  vehicle_type_distribution: VehicleTypeDistribution;
  traffic_flow_direction: string;
  red_light_violations: number;
  temperature: number;
  humidity: number;
  wind_speed: number;
  air_quality_index: number;
  near_miss_events: number;
  accident_severity: string;
  roadwork_detected: boolean;
  illegal_parking_cases: number;
} 