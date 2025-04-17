"use client";

import { useState, useEffect } from "react";
import {
  IntersectionData,
  TrafficData,
  VehicleData,
  AlertData,
} from "../types";
import { trafficApi } from "../lib/api";

interface TrafficDataState {
  intersectionData: IntersectionData | null;
  trafficData: TrafficData | null;
  vehicleData: VehicleData[];
  alertData: AlertData[];
  loading: boolean;
  error: string | null;
}

export const useTrafficData = () => {
  const [state, setState] = useState<TrafficDataState>({
    intersectionData: null,
    trafficData: null,
    vehicleData: [],
    alertData: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        // Start polling for data with callbacks
        const stopIntersectionPolling =
          trafficApi.startPolling<IntersectionData>(
            "intersection",
            (data) => {
              setState((prev) => ({
                ...prev,
                intersectionData: data,
                loading: false,
              }));
            },
            5000 // 5 seconds
          );

        const stopTrafficPolling = trafficApi.startPolling<TrafficData>(
          "traffic",
          (data) => {
            setState((prev) => ({
              ...prev,
              trafficData: data,
              loading: false,
            }));
          },
          5000 // 5 seconds
        );

        const stopVehiclePolling = trafficApi.startPolling<VehicleData[]>(
          "vehicle",
          (data) => {
            setState((prev) => ({
              ...prev,
              vehicleData: data,
              loading: false,
            }));
          },
          3000 // 3 seconds - vehicles update more frequently
        );

        const stopAlertPolling = trafficApi.startPolling<AlertData[]>(
          "alert",
          (data) => {
            setState((prev) => ({
              ...prev,
              alertData: data,
              loading: false,
            }));
          },
          10000 // 10 seconds - alerts are less frequent
        );

        // Return clean-up function
        return () => {
          stopIntersectionPolling();
          stopTrafficPolling();
          stopVehiclePolling();
          stopAlertPolling();
        };
      } catch (error) {
        console.error("Error in fetching traffic data:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to fetch traffic data",
        }));
      }
    };

    fetchData();
  }, []);

  return {
    ...state,
    refreshData: async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const intersectionData = await trafficApi.getIntersectionData();
        const trafficData = await trafficApi.getTrafficData();
        const vehicleData = await trafficApi.getVehicleData();
        const alertData = await trafficApi.getAlerts();

        setState({
          intersectionData,
          trafficData,
          vehicleData,
          alertData,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error refreshing data:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to refresh data",
        }));
      }
    },
  };
};
