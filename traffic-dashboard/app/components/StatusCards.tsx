"use client";

import { IntersectionData, TrafficData } from "../types";
import {
  AlertTriangle,
  Car,
  Clock,
  CloudRain,
  Users,
  Gauge,
  BadgeAlert,
} from "lucide-react";

interface StatusCardsProps {
  intersectionData: IntersectionData;
  trafficData?: TrafficData;
}

const StatusCards = ({ intersectionData, trafficData }: StatusCardsProps) => {
  const getCongestionColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getWeatherIcon = (conditions: string) => {
    switch (conditions?.toLowerCase()) {
      case "rain":
        return <CloudRain className="h-6 w-6 text-blue-500" />;
      case "snow":
        return <CloudRain className="h-6 w-6 text-blue-200" />;
      default:
        return <CloudRain className="h-6 w-6 text-gray-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Congestion Level */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Congestion Level
            </p>
            <p className="text-2xl font-semibold mt-1">
              {intersectionData.intersection_congestion_level}
            </p>
          </div>
          <div className="rounded-full h-12 w-12 flex items-center justify-center">
            <Gauge className="h-8 w-8 text-indigo-500" />
          </div>
        </div>
        <div className="mt-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${getCongestionColor(
              intersectionData.intersection_congestion_level
            )}`}
          >
            {intersectionData.lane_occupancy}% occupancy
          </span>
        </div>
      </div>

      {/* Waiting Vehicles */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Waiting Vehicles
            </p>
            <p className="text-2xl font-semibold mt-1">
              {intersectionData.stopped_vehicles_count}
            </p>
          </div>
          <div className="rounded-full h-12 w-12 flex items-center justify-center">
            <Car className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            {intersectionData.average_wait_time}s avg wait time
          </span>
        </div>
      </div>

      {/* Pedestrians */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Pedestrians</p>
            <p className="text-2xl font-semibold mt-1">
              {intersectionData.pedestrians_crossing}
            </p>
          </div>
          <div className="rounded-full h-12 w-12 flex items-center justify-center">
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
            {intersectionData.jaywalking_pedestrians} jaywalking
          </span>
        </div>
      </div>

      {/* Weather Conditions */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Weather Conditions
            </p>
            <p className="text-2xl font-semibold mt-1">
              {intersectionData.local_weather_conditions}
            </p>
          </div>
          <div className="rounded-full h-12 w-12 flex items-center justify-center">
            {getWeatherIcon(intersectionData.local_weather_conditions)}
          </div>
        </div>
        {intersectionData.fog_or_smoke_detected && (
          <div className="mt-2">
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
              Reduced visibility
            </span>
          </div>
        )}
      </div>

      {/* Near Miss Incidents */}
      {intersectionData.near_miss_incidents > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Near Miss Incidents
              </p>
              <p className="text-2xl font-semibold mt-1">
                {intersectionData.near_miss_incidents}
              </p>
            </div>
            <div className="rounded-full h-12 w-12 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </div>
        </div>
      )}

      {/* Compliance Rate */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Light Compliance
            </p>
            <p className="text-2xl font-semibold mt-1">
              {intersectionData.traffic_light_compliance_rate}%
            </p>
          </div>
          <div className="rounded-full h-12 w-12 flex items-center justify-center">
            <BadgeAlert className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="mt-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              intersectionData.traffic_light_compliance_rate > 90
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {intersectionData.traffic_light_status} light
          </span>
        </div>
      </div>

      {/* Current Time */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Crossing Time</p>
            <p className="text-2xl font-semibold mt-1">
              {intersectionData.intersection_crossing_time}s
            </p>
          </div>
          <div className="rounded-full h-12 w-12 flex items-center justify-center">
            <Clock className="h-8 w-8 text-gray-500" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
            Last updated:{" "}
            {new Date(intersectionData.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatusCards;
