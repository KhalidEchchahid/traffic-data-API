"use client";

import { IntersectionData, TrafficData } from "../types";
import dynamic from "next/dynamic";

// Use dynamic imports for Leaflet components to avoid SSR issues
const MapComponent = dynamic(() => import("./LeafletMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full flex items-center justify-center bg-gray-100 rounded-xl">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

interface IntersectionMapProps {
  intersectionData: IntersectionData;
  trafficData?: TrafficData;
}

const getStatusColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case "low":
      return "#4cd137";
    case "medium":
      return "#ffa502";
    case "high":
      return "#e84118";
    default:
      return "#7f8fa6";
  }
};

const IntersectionMap = ({
  intersectionData,
  trafficData,
}: IntersectionMapProps) => {
  // Default to a location in Casablanca if no coordinates provided
  const position: [number, number] = trafficData
    ? [trafficData.location_y, trafficData.location_x]
    : [33.5731, -7.5898];

  const congestionColor = getStatusColor(
    intersectionData.intersection_congestion_level
  );

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden shadow-lg">
      <MapComponent
        position={position}
        intersectionData={intersectionData}
        congestionColor={congestionColor}
      />
    </div>
  );
};

export default IntersectionMap;
