import { NextResponse } from "next/server";
import { IntersectionData } from "../../types";

export async function GET() {
  const mockData: IntersectionData = {
    id: "1",
    intersection_id: "bd-anfa-bd-zerktouni",
    intersection_congestion_level: "medium",
    stopped_vehicles_count: 25,
    pedestrian_count: 12,
    bicycle_count: 5,
    average_wait_time: 45,
    traffic_light_status: "green",
    timestamp: new Date().toISOString(),
    local_weather_conditions: "clear",
    fog_or_smoke_detected: false,
    risky_behavior_detected: false,
    sudden_braking_events: 2,
    left_turn_count: 8,
    right_turn_count: 6,
  };

  return NextResponse.json([mockData]);
}
