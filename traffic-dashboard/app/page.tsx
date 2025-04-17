"use client";

import { useState, useEffect } from "react";
import { useTrafficData } from "./hooks/useTrafficData";
import Dashboard from "./components/Dashboard";
import EnhancedMap from "./components/EnhancedMap";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Home() {
  const {
    intersectionData,
    trafficData,
    vehicleData,
    alertData,
    loading,
    error,
    refreshData,
  } = useTrafficData();

  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Manual refresh handler
  const handleRefresh = () => {
    refreshData();
  };

  // Set up manual refresh interval if enabled
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      refreshData();
    }, 30000); // Manual refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshData]);

  return (
    <main className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Smart Traffic Dashboard
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {loading ? "Refreshing..." : "Refresh Data"}
            </button>
            <div className="flex items-center">
              <input
                id="auto-refresh"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={isAutoRefresh}
                onChange={(e) => setIsAutoRefresh(e.target.checked)}
              />
              <label
                htmlFor="auto-refresh"
                className="ml-2 block text-sm text-gray-900"
              >
                Auto refresh
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Map section */}
          <div className="lg:col-span-8 bg-white shadow-sm rounded-lg p-4 h-[600px]">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Traffic Map
            </h2>
            <div className="h-[530px] relative">
              <EnhancedMap
                vehicleData={vehicleData}
                trafficData={trafficData}
                alertData={alertData}
                intersectionData={intersectionData}
              />
            </div>
          </div>

          {/* Dashboard metrics */}
          <div className="lg:col-span-4">
            <Dashboard
              intersectionData={intersectionData}
              trafficData={trafficData}
              alertData={alertData}
              vehicleData={vehicleData}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white shadow-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-500 text-center">
            © 2023 Smart Traffic Dashboard. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
