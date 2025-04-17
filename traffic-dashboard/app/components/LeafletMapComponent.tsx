"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { IntersectionData } from "../types";
import { AlertTriangle, Car, Clock } from "lucide-react";

interface LeafletMapComponentProps {
  position: [number, number];
  intersectionData: IntersectionData;
  congestionColor: string;
}

const LeafletMapComponent = ({
  position,
  intersectionData,
  congestionColor,
}: LeafletMapComponentProps) => {
  // Fix Leaflet icon issue with Next.js
  useEffect(() => {
    // Fix for Leaflet marker icons
    (async () => {
      const L = await import("leaflet");
      // Fix the default icon issue
      delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      });
    })();
  }, []);

  return (
    <MapContainer
      center={position}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Congestion circle */}
      <Circle
        center={position}
        pathOptions={{
          color: congestionColor,
          fillColor: congestionColor,
          fillOpacity: 0.2,
        }}
        radius={200}
      />

      {/* Intersection marker */}
      <Marker position={position}>
        <Popup>
          <div className="p-2">
            <h3 className="font-semibold text-lg">
              {intersectionData.intersection_id}
            </h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-1">
                <Car size={16} />
                <span className="text-sm">
                  {intersectionData.stopped_vehicles_count} vehicles
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span className="text-sm">
                  {intersectionData.average_wait_time}s wait
                </span>
              </div>
              {intersectionData.risky_behavior_detected && (
                <div className="flex items-center gap-1 col-span-2 text-red-500">
                  <AlertTriangle size={16} />
                  <span className="text-sm">Risky behavior detected</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Last updated:{" "}
              {new Date(intersectionData.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default LeafletMapComponent;
