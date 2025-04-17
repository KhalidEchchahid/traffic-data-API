"use client";

import { useEffect, useRef, useState } from "react";
import {
  IntersectionData,
  TrafficData,
  VehicleData,
  AlertData,
} from "../types";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import gsap from "gsap";
import {
  AlertTriangle,
  Car,
  Bike,
  Bus,
  Truck,
  Clock,
  Navigation,
} from "lucide-react";

// Animation controller for map elements
const AnimationController = ({
  vehicles,
  intersectionData,
}: {
  vehicles: VehicleData[];
  intersectionData: IntersectionData;
}) => {
  const map = useMap();
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const pathsRef = useRef<{ [key: string]: L.Polyline }>({});
  const tlRef = useRef<L.DivIcon | null>(null);
  const [trafficLightColor, setTrafficLightColor] = useState<string>(
    intersectionData.traffic_light_status || "green"
  );

  // Custom vehicle icons based on type
  useEffect(() => {
    // Create traffic light icon
    const createTrafficLightIcon = (color: string) => {
      return L.divIcon({
        className: "custom-div-icon",
        html: `<div style="background-color: ${
          color === "green"
            ? "#4cd137"
            : color === "red"
            ? "#e84118"
            : "#ffa502"
        }; 
                width: 20px; height: 20px; border-radius: 50%; box-shadow: 0 0 10px 5px ${
                  color === "green"
                    ? "rgba(76, 209, 55, 0.7)"
                    : color === "red"
                    ? "rgba(232, 65, 24, 0.7)"
                    : "rgba(255, 165, 2, 0.7)"
                };"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    };

    // Create vehicle icons
    const createVehicleIcon = (type: string) => {
      const getColor = () => {
        switch (type) {
          case "passenger_car":
            return "#3498db";
          case "suv":
            return "#2ecc71";
          case "motorcycle":
            return "#e74c3c";
          case "bus":
            return "#9b59b6";
          case "delivery_van":
            return "#f1c40f";
          case "pickup_truck":
            return "#e67e22";
          case "semi_truck":
            return "#34495e";
          default:
            return "#95a5a6";
        }
      };

      const getSize = () => {
        switch (type) {
          case "bus":
          case "semi_truck":
            return [30, 30];
          case "delivery_van":
          case "pickup_truck":
            return [24, 24];
          case "suv":
            return [22, 22];
          case "passenger_car":
            return [20, 20];
          case "motorcycle":
            return [16, 16];
          default:
            return [20, 20];
        }
      };

      const color = getColor();
      const size = getSize();

      return L.divIcon({
        className: "custom-vehicle-icon",
        html: `<div style="background-color: ${color}; width: ${size[0]}px; height: ${size[1]}px; 
                border-radius: 4px; transform: rotate(0deg); transition: transform 0.5s ease-in-out;"></div>`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1] / 2],
      });
    };

    // Set traffic light marker
    if (intersectionData) {
      const position = map.getCenter();

      // Traffic light icon
      if (!tlRef.current) {
        const tlIcon = createTrafficLightIcon(
          intersectionData.traffic_light_status || "green"
        );
        const tlMarker = L.marker(position, {
          icon: tlIcon,
          zIndexOffset: 1000,
        }).addTo(map);
        tlRef.current = tlIcon;
      } else if (intersectionData.traffic_light_status !== trafficLightColor) {
        setTrafficLightColor(intersectionData.traffic_light_status || "green");
        // Update traffic light color
        const tlIcon = createTrafficLightIcon(
          intersectionData.traffic_light_status || "green"
        );
        map.eachLayer((layer) => {
          if (
            layer instanceof L.Marker &&
            layer.getLatLng().equals(map.getCenter())
          ) {
            layer.setIcon(tlIcon);
          }
        });
      }
    }

    // Update vehicles
    if (vehicles && vehicles.length > 0) {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const radius = center.distanceTo(bounds.getNorthEast()) * 0.5;

      // Generate routes for vehicles
      vehicles.forEach((vehicle) => {
        const vehicleId = vehicle.id;

        // If we don't have this vehicle yet, create a marker
        if (!markersRef.current[vehicleId]) {
          // Create random start position around the intersection
          const angle = Math.random() * Math.PI * 2;
          const distance = radius * 0.3 + Math.random() * radius * 0.4;
          const startPos = L.latLng(
            center.lat + (Math.sin(angle) * distance) / 111000,
            center.lng +
              (Math.cos(angle) * distance) /
                (111000 * Math.cos((center.lat * Math.PI) / 180))
          );

          // Create destination (opposite side of the intersection)
          const destAngle = angle + Math.PI + (Math.random() * 0.5 - 0.25);
          const destPos = L.latLng(
            center.lat + (Math.sin(destAngle) * distance) / 111000,
            center.lng +
              (Math.cos(destAngle) * distance) /
                (111000 * Math.cos((center.lat * Math.PI) / 180))
          );

          // Create icon
          const vehicleIcon = createVehicleIcon(vehicle.vehicle_class);

          // Create marker
          const marker = L.marker(startPos, { icon: vehicleIcon }).addTo(map);

          // Create path
          const path = L.polyline([startPos, destPos], { opacity: 0 }).addTo(
            map
          );

          // Store references
          markersRef.current[vehicleId] = marker;
          pathsRef.current[vehicleId] = path;

          // Calculate rotation angle
          const dx = destPos.lng - startPos.lng;
          const dy = destPos.lat - startPos.lat;
          const rotationAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

          // Rotate the icon
          const iconElement = marker.getElement()?.querySelector("div");
          if (iconElement) {
            iconElement.style.transform = `rotate(${rotationAngle}deg)`;
          }

          // Animate vehicle along path
          const duration = 20 + Math.random() * 20; // Random duration between 20-40 seconds
          const speed = vehicle.speed_kmh / 3.6; // Convert km/h to m/s

          gsap.to(startPos, {
            lat: destPos.lat,
            lng: destPos.lng,
            duration: duration,
            ease: "linear",
            onUpdate: function () {
              marker.setLatLng(startPos);
            },
            onComplete: function () {
              // Remove vehicle when animation completes
              map.removeLayer(marker);
              map.removeLayer(path);
              delete markersRef.current[vehicleId];
              delete pathsRef.current[vehicleId];
            },
          });
        }
      });
    }

    // Cleanup function
    return () => {
      // Remove all markers and paths
      Object.values(markersRef.current).forEach((marker) => {
        map.removeLayer(marker);
      });
      Object.values(pathsRef.current).forEach((path) => {
        map.removeLayer(path);
      });
    };
  }, [map, vehicles, intersectionData, trafficLightColor]);

  return null;
};

// Define props for EnhancedMap
interface EnhancedMapProps {
  intersectionData: IntersectionData | null;
  trafficData: TrafficData | null;
  vehicleData: VehicleData[];
  alertData?: AlertData[];
}

const EnhancedMap = ({
  intersectionData,
  trafficData,
  vehicleData,
  alertData = [],
}: EnhancedMapProps) => {
  // Default location (Casablanca)
  const position: [number, number] = [-7.6356, 33.5912];

  if (!intersectionData || !trafficData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
        <p className="text-gray-500">Waiting for traffic data...</p>
      </div>
    );
  }

  // Fix Leaflet icon issue with Next.js
  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      });
    })();
  }, []);

  // Get congestion status color
  const getCongestionColor = (level: string) => {
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

  const congestionColor = getCongestionColor(
    intersectionData.intersection_congestion_level
  );

  // Vehicle count by type
  const vehicleCountByType = vehicleData.reduce((acc, vehicle) => {
    acc[vehicle.vehicle_class] = (acc[vehicle.vehicle_class] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get vehicle icon based on type
  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "motorcycle":
        return <Bike size={14} />;
      case "bus":
        return <Bus size={14} />;
      case "semi_truck":
      case "pickup_truck":
        return <Truck size={14} />;
      default:
        return <Car size={14} />;
    }
  };

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-xl relative">
      {/* Traffic light status indicator */}
      <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded-md shadow-md flex items-center space-x-2">
        <div className="text-sm font-medium">Traffic Light:</div>
        <div
          className={`w-4 h-4 rounded-full ${
            intersectionData.traffic_light_status === "green"
              ? "bg-green-500"
              : intersectionData.traffic_light_status === "red"
              ? "bg-red-500"
              : "bg-yellow-500"
          }`}
        ></div>
      </div>

      {/* Weather indicator */}
      <div className="absolute top-4 left-4 z-10 bg-white p-2 rounded-md shadow-md">
        <div className="text-sm font-medium">
          {intersectionData.local_weather_conditions || "Clear"}
          {intersectionData.fog_or_smoke_detected && " / Reduced Visibility"}
        </div>
      </div>

      {/* Active vehicles */}
      <div className="absolute bottom-4 left-4 z-10 bg-white p-2 rounded-md shadow-md max-w-[200px]">
        <div className="text-sm font-medium mb-1">Active Vehicles</div>
        <div className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(vehicleCountByType).map(([type, count]) => (
            <div key={type} className="flex items-center gap-1">
              {getVehicleIcon(type)}
              <span>
                {count} {type.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <MapContainer
        center={position}
        zoom={16}
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
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "5, 5",
          }}
          radius={300}
        />

        {/* Intersection marker */}
        <Marker position={position}>
          <Popup>
            <div className="p-2 max-w-[250px]">
              <h3 className="font-semibold text-lg">
                {intersectionData.intersection_id}
              </h3>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Car size={16} className="text-blue-500" />
                  <span className="text-sm">
                    {intersectionData.stopped_vehicles_count} vehicles
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={16} className="text-green-500" />
                  <span className="text-sm">
                    {intersectionData.average_wait_time}s wait
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Navigation size={16} className="text-purple-500" />
                  <span className="text-sm">
                    {intersectionData.left_turn_count} left turns
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Navigation
                    size={16}
                    className="text-indigo-500"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <span className="text-sm">
                    {intersectionData.right_turn_count} right turns
                  </span>
                </div>

                {intersectionData.risky_behavior_detected && (
                  <div className="flex items-center gap-1 col-span-2 text-red-500">
                    <AlertTriangle size={16} />
                    <span className="text-sm">Risky behavior detected</span>
                  </div>
                )}

                {intersectionData.sudden_braking_events > 0 && (
                  <div className="flex items-center gap-1 col-span-2 text-amber-500">
                    <AlertTriangle size={16} />
                    <span className="text-sm">
                      {intersectionData.sudden_braking_events} sudden braking
                      events
                    </span>
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

        {/* Animation controller */}
        <AnimationController
          vehicles={vehicleData}
          intersectionData={intersectionData}
        />
      </MapContainer>
    </div>
  );
};

export default EnhancedMap;
