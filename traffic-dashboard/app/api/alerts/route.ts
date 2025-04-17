import { NextResponse } from "next/server";
import { AlertData } from "../../types";

export async function GET() {
  const mockData: AlertData[] = [
    {
      id: "alert-1",
      alert_type: "Traffic Congestion",
      alert_severity: "medium",
      alert_message:
        "Heavy traffic detected at intersection bd-anfa-bd-zerktouni",
      location_x: -7.6356,
      location_y: 33.5912,
      timestamp: new Date().toISOString(),
      resolved: false,
      detected_by_sensor_id: "sensor-001",
    },
    {
      id: "alert-2",
      alert_type: "Emergency Vehicle",
      alert_severity: "high",
      alert_message: "Emergency vehicle approaching from north",
      location_x: -7.634,
      location_y: 33.592,
      timestamp: new Date().toISOString(),
      resolved: false,
      detected_by_sensor_id: "sensor-002",
    },
  ];

  return NextResponse.json(mockData);
}
