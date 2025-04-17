export interface IntersectionData {
  id: string;
  intersection_id: string;
  intersection_congestion_level: string;
  stopped_vehicles_count: number;
  pedestrian_count: number;
  bicycle_count: number;
  average_wait_time: number;
  traffic_light_status: string;
  timestamp: string;
  local_weather_conditions?: string;
  fog_or_smoke_detected?: boolean;
  risky_behavior_detected?: boolean;
  sudden_braking_events?: number;
  left_turn_count?: number;
  right_turn_count?: number;
}

export interface TrafficData {
  id: string;
  traffic_flow_rate: number;
  average_vehicle_speed: number;
  traffic_congestion_level: string;
  road_surface_condition: string;
  emergency_vehicle_detected: boolean;
  timestamp: string;
  location_x: number;
  location_y: number;
}

export interface VehicleData {
  id: string;
  vehicle_class: string;
  speed_kmh: number;
  position_x?: number;
  position_y?: number;
  direction_degrees?: number;
  timestamp: string;
}

export interface AlertData {
  id: string;
  alert_type: string;
  alert_severity: string;
  alert_message: string;
  location_x?: number;
  location_y?: number;
  timestamp: string;
  resolved: boolean;
  detected_by_sensor_id?: string;
} 