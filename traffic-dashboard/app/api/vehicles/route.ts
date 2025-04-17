import { NextResponse } from "next/server";
import { VehicleData } from "../../types";

export async function GET() {
  const vehicleClasses = [
    "passenger_car",
    "suv",
    "motorcycle",
    "bus",
    "delivery_van",
    "pickup_truck",
    "semi_truck",
  ];

  const mockData: VehicleData[] = Array.from({ length: 20 }, (_, i) => ({
    id: `vehicle-${i + 1}`,
    vehicle_class:
      vehicleClasses[Math.floor(Math.random() * vehicleClasses.length)],
    speed_kmh: 20 + Math.floor(Math.random() * 60),
    position_x: -7.6356 + (Math.random() * 0.01 - 0.005),
    position_y: 33.5912 + (Math.random() * 0.01 - 0.005),
    direction_degrees: Math.floor(Math.random() * 360),
    timestamp: new Date().toISOString(),
  }));

  return NextResponse.json(mockData);
}
