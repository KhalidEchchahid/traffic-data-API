"use client";

import {
  IntersectionData,
  TrafficData,
  VehicleData,
  AlertData,
} from "../types";
import {
  Car,
  Clock,
  AlertTriangle,
  User,
  Bike,
  ArrowRight,
  ArrowLeft,
  BarChart2,
  Sun,
  CloudFog,
  BarChart4,
  Wind,
  Shield,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";

interface DashboardProps {
  intersectionData: IntersectionData | null;
  trafficData: TrafficData | null;
  vehicleData: VehicleData[];
  alertData: AlertData[];
  loading: boolean;
}

const Dashboard = ({
  intersectionData,
  trafficData,
  vehicleData,
  alertData,
  loading,
}: DashboardProps) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!intersectionData || !trafficData) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              No traffic data available. Please check your connection or try
              again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts Card */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
          Active Alerts
        </h2>
        <div className="space-y-3">
          {alertData && alertData.length > 0 ? (
            alertData.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-md ${
                  alert.alert_severity === "high"
                    ? "bg-red-50 border-l-4 border-red-500"
                    : alert.alert_severity === "medium"
                    ? "bg-orange-50 border-l-4 border-orange-500"
                    : "bg-blue-50 border-l-4 border-blue-500"
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {alert.alert_severity === "high" ? (
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                    ) : alert.alert_severity === "medium" ? (
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <Shield className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      {alert.alert_type}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {alert.alert_message}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p>No active alerts</p>
            </div>
          )}
        </div>
      </div>

      {/* Intersection Card */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <BarChart4 className="h-5 w-5 mr-2 text-indigo-500" />
          Intersection Status
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-indigo-100">
              <BarChart2 className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Congestion</p>
              <p className="font-medium">
                {intersectionData.intersection_congestion_level
                  .charAt(0)
                  .toUpperCase() +
                  intersectionData.intersection_congestion_level.slice(1)}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-red-100">
              <Car className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Stopped</p>
              <p className="font-medium">
                {intersectionData.stopped_vehicles_count} vehicles
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-green-100">
              <User className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pedestrians</p>
              <p className="font-medium">
                {intersectionData.pedestrian_count} people
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-purple-100">
              <Bike className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bicycles</p>
              <p className="font-medium">
                {intersectionData.bicycle_count} bikes
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-orange-100">
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Wait Time</p>
              <p className="font-medium">
                {intersectionData.average_wait_time}s
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-blue-100">
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Turns</p>
              <p className="font-medium">
                L: {intersectionData.left_turn_count}, R:{" "}
                {intersectionData.right_turn_count}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Card */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <Car className="h-5 w-5 mr-2 text-blue-500" />
          Traffic Flow
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-blue-100">
              <Car className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Flow Rate</p>
              <p className="font-medium">
                {trafficData.traffic_flow_rate} v/min
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-green-100">
              <Wind className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Speed</p>
              <p className="font-medium">
                {trafficData.average_vehicle_speed} km/h
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-yellow-100">
              <BarChart2 className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Congestion</p>
              <p className="font-medium">
                {trafficData.traffic_congestion_level.charAt(0).toUpperCase() +
                  trafficData.traffic_congestion_level.slice(1)}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-purple-100">
              <Sun className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Road Surface</p>
              <p className="font-medium">
                {trafficData.road_surface_condition}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Conditions */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <CloudFog className="h-5 w-5 mr-2 text-gray-500" />
          Environment
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-blue-100">
              <Sun className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Weather</p>
              <p className="font-medium">
                {intersectionData.local_weather_conditions || "Clear"}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-3 rounded-full p-2 bg-gray-100">
              <CloudFog className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Visibility</p>
              <p className="font-medium">
                {intersectionData.fog_or_smoke_detected ? "Reduced" : "Good"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Count Summary */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <Car className="h-5 w-5 mr-2 text-gray-500" />
          Vehicle Summary
        </h2>
        <p className="text-gray-700">
          <span className="font-medium">{vehicleData.length}</span> active
          vehicles tracked
        </p>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
