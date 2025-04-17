import { NextResponse } from 'next/server';
import { TrafficData } from '../../types';

export async function GET() {
  const mockData: TrafficData = {
    id: '1',
    traffic_flow_rate: 120,
    average_vehicle_speed: 45,
    traffic_congestion_level: 'medium',
    road_surface_condition: 'dry',
    emergency_vehicle_detected: false,
    timestamp: new Date().toISOString(),
    location_x: -7.6356,
    location_y: 33.5912
  };
  
  return NextResponse.json([mockData]);
} 