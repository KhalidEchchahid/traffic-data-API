"use client";

import { IntersectionData } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart2, Car, Users } from "lucide-react";

interface IntersectionStatsProps {
  data: IntersectionData;
}

const IntersectionStats = ({ data }: IntersectionStatsProps) => {
  // Create data for queue length chart
  const queueData = Object.entries(data.queue_length_by_lane).map(
    ([lane, value]) => ({
      name: lane,
      value,
    })
  );

  // Create data for turn counts chart
  const turnData = [
    { name: "Left", value: data.left_turn_count },
    { name: "Right", value: data.right_turn_count },
  ];

  // Create data for pedestrian/cyclist chart
  const roadUserData = [
    { name: "Pedestrians", value: data.pedestrians_crossing },
    { name: "Jaywalkers", value: data.jaywalking_pedestrians },
    { name: "Cyclists", value: data.cyclists_crossing },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  // Create data for speed by direction chart
  const speedData = Object.entries(data.average_speed_by_direction).map(
    ([direction, value]) => ({
      name: direction.replace("_", " "),
      value,
    })
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* Queue Length by Lane */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <Car className="text-blue-500" />
          <h3 className="text-lg font-semibold">Queue Length by Lane</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={queueData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${value} vehicles`, "Queue Length"]}
                labelFormatter={(label) => `Lane ${label}`}
              />
              <Bar dataKey="value" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Turn Counts */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold">Turn Distribution</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={turnData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {turnData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} vehicles`, "Count"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Road Users */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-purple-500" />
          <h3 className="text-lg font-semibold">Road Users</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={roadUserData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#FFBB28" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Average Speed by Direction */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="text-red-500" />
          <h3 className="text-lg font-semibold">Speed by Direction</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={speedData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} km/h`, "Speed"]} />
              <Bar dataKey="value" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default IntersectionStats;
