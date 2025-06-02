# Advanced Analytics & Intelligence API Documentation

## Overview

This document covers the advanced analytics, intelligence, and coordination features of the Traffic Monitoring API v2.0. These endpoints provide sophisticated data analysis, risk assessment, historical patterns, and intersection coordination intelligence for building comprehensive dashboards.

**Focus Areas**: 🔍 Risk Analysis, 📊 Historical Analytics, 🎯 Coordination Intelligence, 🌦️ Weather Correlation

---

## 🚨 Risk Analysis & Safety Intelligence

### GET `/api/risk/analysis`

Comprehensive multi-factor risk assessment with real-time analysis and actionable recommendations.

**Query Parameters:**
```typescript
interface RiskAnalysisParams {
  intersection_id?: string;     // Filter by specific intersection
  sensor_id?: string;          // Filter by specific sensor
  location_id?: string;        // Filter by location
  include_historical?: boolean; // Include historical pattern analysis (default: true)
  time_window?: number;        // Minutes for recent data analysis (default: 60)
}
```

**Response:**
```typescript
interface RiskAnalysisResponse {
  risk_analysis: {
    overall_risk: {
      score: number;           // 0-100 risk score
      level: string;           // "critical" | "high" | "medium" | "low"
      timestamp: string;
      confidence: number;      // 0.0-1.0 confidence in assessment
    };
    
    risk_breakdown: {
      traffic: number;         // Traffic-related risk (35% weight)
      intersection: number;    // Intersection-specific risk (25% weight)
      environment: number;     // Environmental factors (20% weight)
      incidents: number;       // Historical incidents (20% weight)
    };
    
    risk_factors: {
      category: string;        // "traffic" | "intersection" | "environment" | "incidents"
      factor: string;          // Specific risk factor identifier
      severity: string;        // "critical" | "high" | "medium" | "low"
      value: number;          // Measured value
      threshold: number;       // Risk threshold
      description: string;     // Human-readable description
      impact: string;         // Expected impact
    }[];
  };
  
  current_conditions: {
    traffic_data: TrafficData | null;
    intersection_data: IntersectionData | null;
    recent_alerts: {
      count: number;
      time_window_minutes: number;
      high_severity_count: number;
      alerts: AlertData[];
    };
    weather_conditions: WeatherState | null;
  };
  
  recommendations: {
    priority: string;          // "critical" | "high" | "medium" | "low"
    action: string;           // "immediate_intervention" | "increased_monitoring" | "alert_dispatch"
    description: string;
    estimated_impact: string;
    timeframe: string;        // "immediate" | "1-hour" | "end-of-day"
  }[];
  
  historical_analysis?: {
    patterns: {
      type: string;           // "peak_risk_hour" | "weather_correlation" | "incident_hotspot"
      description: string;
      severity: string;
      value: number;
      frequency: string;
    }[];
    
    hourly_averages: {
      hour: number;
      avg_risk_score: number;
      incident_count: number;
    }[];
    
    daily_averages: {
      day_of_week: number;
      avg_risk_score: number;
      peak_hour: number;
    }[];
    
    risk_trends: {
      period: string;         // "7_days" | "30_days"
      trend: string;          // "increasing" | "decreasing" | "stable"
      change_percentage: number;
    };
  };
}
```

**Risk Calculation Algorithm:**
```typescript
interface RiskFactorWeights {
  traffic: 0.35;              // Speed, density, congestion, incidents
  intersection: 0.25;         // Wait times, collisions, risky behavior
  environment: 0.20;          // Weather, visibility, road conditions
  incidents: 0.20;           // Recent alerts, historical patterns
}

// Risk Level Classification:
// Critical: 80-100 points (immediate intervention required)
// High: 60-79 points (increased monitoring needed)
// Medium: 40-59 points (caution advised)
// Low: 0-39 points (normal conditions)
```

**Example Request:**
```bash
GET /api/risk/analysis?intersection_id=bd-anfa-bd-zerktouni&include_historical=true&time_window=120
```

**Example Response:**
```json
{
  "risk_analysis": {
    "overall_risk": {
      "score": 67.5,
      "level": "high",
      "timestamp": "2024-01-15T14:30:00Z",
      "confidence": 0.85
    },
    "risk_breakdown": {
      "traffic": 23.5,
      "intersection": 18.75,
      "environment": 15.0,
      "incidents": 10.25
    },
    "risk_factors": [
      {
        "category": "traffic",
        "factor": "high_density",
        "severity": "high",
        "value": 85,
        "threshold": 70,
        "description": "High traffic density (85%) increases collision risk",
        "impact": "Increased accident probability by 35%"
      },
      {
        "category": "environment",
        "factor": "poor_visibility",
        "severity": "medium",
        "value": 200,
        "threshold": 500,
        "description": "Reduced visibility (200m) due to fog",
        "impact": "Reaction time reduced by 25%"
      }
    ]
  },
  "recommendations": [
    {
      "priority": "high",
      "action": "increased_monitoring",
      "description": "Deploy additional monitoring due to high risk conditions",
      "estimated_impact": "25% reduction in incident probability",
      "timeframe": "1-hour"
    }
  ]
}
```

### GET `/api/risk/heatmap`

Geographical risk mapping with multi-location aggregation and statistical analysis.

**Query Parameters:**
```typescript
interface RiskHeatmapParams {
  time_window?: number;        // Minutes for data aggregation (default: 120)
  min_risk_score?: number;     // Minimum risk score to include (default: 0)
  max_risk_score?: number;     // Maximum risk score to include (default: 100)
  include_factors?: boolean;   // Include detailed risk factors (default: false)
  risk_level?: string;         // Filter by risk level
}
```

**Response:**
```typescript
interface RiskHeatmapResponse {
  heatmap_data: {
    location: {
      intersection_id: string;
      sensor_id: string;
      coordinates: {
        lat: number;
        lng: number;
      };
      name?: string;
    };
    
    risk_score: number;         // 0-100
    risk_level: string;         // "critical" | "high" | "medium" | "low"
    last_updated: string;
    
    risk_breakdown?: {
      traffic: number;
      intersection: number;
      environment: number;
      incidents: number;
    };
    
    risk_factors?: {
      factor: string;
      severity: string;
      contribution: number;     // Percentage contribution to risk
    }[];
    
    stats: {
      traffic: {
        avg_speed: number;
        avg_density: number;
        incident_count: number;
        congestion_level: string;
      };
      intersection: {
        avg_wait_time: number;
        total_collisions: number;
        risky_behavior_incidents: number;
        efficiency_score: number;
      };
      alerts: {
        alert_count: number;
        high_severity_count: number;
        recent_incidents: number;
      };
    };
    
    trend: {
      direction: string;        // "increasing" | "decreasing" | "stable"
      change_24h: number;       // Risk score change in 24 hours
    };
  }[];
  
  summary: {
    total_locations: number;
    time_window_hours: number;
    
    risk_distribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    
    statistics: {
      average_risk_score: number;
      median_risk_score: number;
      max_risk_score: number;
      min_risk_score: number;
    };
    
    highest_risk_location: {
      intersection_id: string;
      risk_score: number;
      primary_risk_factor: string;
    };
    
    risk_trends: {
      overall_trend: string;
      locations_increasing: number;
      locations_decreasing: number;
    };
  };
}
```

**Frontend Integration Example:**
```typescript
// Risk Heatmap Component
const RiskHeatmap: React.FC = () => {
  const { data: heatmapData } = useQuery({
    queryKey: ['risk-heatmap'],
    queryFn: () => fetch('/api/risk/heatmap?include_factors=true').then(r => r.json()),
    refetchInterval: 60000 // Refresh every minute
  });

  const getRiskColor = (riskLevel: string) => {
    const colors = {
      critical: '#dc2626',  // Red
      high: '#ea580c',      // Orange
      medium: '#ca8a04',    // Yellow
      low: '#16a34a'        // Green
    };
    return colors[riskLevel] || '#6b7280';
  };

  return (
    <Map>
      {heatmapData?.heatmap_data.map((location) => (
        <Marker
          key={location.location.intersection_id}
          position={[location.location.coordinates.lat, location.location.coordinates.lng]}
          color={getRiskColor(location.risk_level)}
        >
          <Popup>
            <div>
              <h3>{location.location.intersection_id}</h3>
              <p>Risk Score: {location.risk_score}</p>
              <p>Level: {location.risk_level}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </Map>
  );
};
```

---

## 📊 Historical Analytics & Intelligence

### GET `/api/historical/traffic`

Historical traffic pattern analysis with density vs speed correlation.

**Query Parameters:**
```typescript
interface HistoricalTrafficParams {
  start?: string;              // Start date (ISO string)
  end?: string;                // End date (ISO string)
  aggregation?: string;        // "hour" | "day" | "week" | "month"
  intersection_id?: string;    // Filter by intersection
  sensor_id?: string;          // Filter by sensor
  include_weather?: boolean;   // Include weather correlation
}
```

**Response:**
```typescript
interface HistoricalTrafficResponse {
  traffic_patterns: {
    timestamp: string;
    period: string;            // "2024-01-15T14:00" for hourly
    
    metrics: {
      avg_density: number;
      avg_speed: number;
      avg_travel_time: number;
      total_vehicles: number;
      congestion_duration_minutes: number;
    };
    
    density_speed_correlation: {
      correlation_coefficient: number; // -1 to 1
      relationship: string;     // "strong_negative" | "moderate_negative" | "weak" | "positive"
    };
    
    peak_analysis: {
      is_peak_hour: boolean;
      peak_type: string;        // "morning" | "evening" | "weekend" | "none"
      intensity: number;        // 0.0-1.0
    };
    
    weather_impact?: {
      conditions: string;
      temperature: number;
      speed_impact_percentage: number;
      density_impact_percentage: number;
    };
  }[];
  
  summary: {
    time_range: {
      start: string;
      end: string;
      total_periods: number;
    };
    
    overall_patterns: {
      avg_density: number;
      avg_speed: number;
      peak_hours: number[];     // Hours of day with highest density
      lowest_traffic_hours: number[];
    };
    
    trends: {
      density_trend: string;    // "increasing" | "decreasing" | "stable"
      speed_trend: string;
      efficiency_trend: string;
    };
    
    correlations: {
      density_speed_correlation: number;
      weather_impact_factor: number;
      time_of_day_variance: number;
    };
  };
}
```

### GET `/api/historical/incidents`

Historical incident frequency and pattern analysis.

**Response:**
```typescript
interface HistoricalIncidentsResponse {
  incident_patterns: {
    period: string;
    incident_count: number;
    severity_breakdown: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    
    incident_types: {
      type: string;
      count: number;
      avg_resolution_time: number;
    }[];
    
    hotspots: {
      intersection_id: string;
      incident_count: number;
      primary_incident_type: string;
    }[];
    
    temporal_patterns: {
      peak_incident_hours: number[];
      day_of_week_distribution: {
        day: number;
        incident_count: number;
      }[];
    };
  }[];
  
  predictive_insights: {
    high_risk_periods: {
      start_hour: number;
      end_hour: number;
      risk_level: string;
      historical_incident_rate: number;
    }[];
    
    seasonal_patterns: {
      season: string;
      incident_rate_change: number;
      primary_factors: string[];
    }[];
  };
}
```

### GET `/api/historical/congestion`

Congestion heatmap and pattern analysis.

**Response:**
```typescript
interface HistoricalCongestionResponse {
  congestion_heatmap: {
    intersection_id: string;
    coordinates: [number, number];
    
    congestion_metrics: {
      avg_congestion_level: number;     // 0.0-1.0
      peak_congestion_level: number;
      congestion_duration_hours: number;
      frequency_percentage: number;
    };
    
    time_patterns: {
      morning_peak: {
        start_hour: number;
        end_hour: number;
        intensity: number;
      };
      evening_peak: {
        start_hour: number;
        end_hour: number;
        intensity: number;
      };
      weekend_patterns: {
        avg_congestion: number;
        peak_hours: number[];
      };
    };
    
    contributing_factors: {
      weather_correlation: number;
      incident_correlation: number;
      traffic_light_efficiency: number;
    };
  }[];
  
  network_analysis: {
    total_intersections: number;
    highly_congested_count: number;    // > 70% congestion
    bottleneck_intersections: string[];
    
    congestion_propagation: {
      source_intersection: string;
      affected_intersections: string[];
      propagation_time_minutes: number;
    }[];
  };
}
```

### GET `/api/historical/weather`

Weather impact analysis and distribution patterns.

**Response:**
```typescript
interface HistoricalWeatherResponse {
  weather_distribution: {
    condition: string;           // "sunny" | "rain" | "snow" | "fog"
    frequency_percentage: number;
    
    traffic_impact: {
      avg_speed_change: number;  // Percentage change from baseline
      avg_density_change: number;
      incident_rate_multiplier: number;
      congestion_increase: number;
    };
    
    intersection_specific_impact: {
      intersection_id: string;
      speed_impact: number;
      efficiency_impact: number;
      incident_count: number;
    }[];
  }[];
  
  correlation_analysis: {
    temperature_traffic_correlation: number;
    humidity_impact_factor: number;
    visibility_safety_correlation: number;
    
    critical_weather_thresholds: {
      temperature_critical: number;    // Below this temp = high risk
      visibility_critical: number;     // Below this visibility = high risk
      wind_speed_critical: number;
    };
  };
  
  seasonal_insights: {
    season: string;
    predominant_conditions: string[];
    traffic_efficiency_rating: number;
    safety_risk_level: string;
  }[];
}
```

---

## 🎯 Intersection Coordination Intelligence

### GET `/api/coordination/intersections`

All intersections coordination overview with system-wide health monitoring.

**Query Parameters:**
```typescript
interface CoordinationOverviewParams {
  status_filter?: string;      // "coordinated" | "legacy" | "offline"
  min_efficiency?: number;     // Minimum efficiency threshold
  include_diagnostics?: boolean;
}
```

**Response:**
```typescript
interface CoordinationOverviewResponse {
  intersections: {
    intersection_id: string;
    coordinates: [number, number];
    
    coordination_status: {
      is_coordinated: boolean;
      mode: string;            // "enhanced" | "legacy" | "offline"
      last_update: string;
      uptime_percentage: number;
    };
    
    performance_metrics: {
      efficiency_score: number; // 0.0-1.0
      total_vehicles: number;
      avg_wait_time: number;
      light_cycle_efficiency: number;
    };
    
    sensor_health: {
      total_sensors: number;
      active_sensors: number;
      sensor_directions: string[];
      health_status: string;   // "excellent" | "good" | "degraded" | "poor"
    };
    
    weather_sync: {
      is_synchronized: boolean;
      last_weather_update: string;
      consistency_score: number; // 0.0-1.0
    };
  }[];
  
  system_overview: {
    total_intersections: number;
    coordinated_intersections: number;
    coordination_rate: number;   // Percentage
    
    performance_summary: {
      avg_system_efficiency: number;
      total_vehicles_managed: number;
      avg_response_time_ms: number;
    };
    
    health_distribution: {
      excellent: number;
      good: number;
      degraded: number;
      poor: number;
      offline: number;
    };
  };
}
```

### GET `/api/coordination/intersections/:id/status`

Comprehensive coordination status for specific intersection.

**Response:**
```typescript
interface IntersectionCoordinationStatus {
  intersection_id: string;
  
  coordination_details: {
    mode: string;              // "enhanced" | "legacy"
    status: string;            // "active" | "degraded" | "offline"
    last_update: string;
    uptime_24h: number;        // Percentage
    
    capabilities: {
      weather_synchronization: boolean;
      traffic_light_coordination: boolean;
      flow_tracking: boolean;
      multi_sensor_coordination: boolean;
    };
  };
  
  sensor_coordination: {
    total_sensors: number;
    active_sensors: number;
    
    sensor_details: {
      direction: string;       // "north" | "south" | "east" | "west"
      sensor_id: string;
      status: string;          // "active" | "warning" | "offline"
      last_data: string;
      data_quality: number;    // 0.0-1.0
      
      current_metrics: {
        vehicle_count: number;
        avg_speed: number;
        flow_rate: number;
        queue_length: number;
      };
    }[];
    
    coordination_quality: {
      sync_score: number;      // 0.0-1.0
      data_consistency: number;
      temporal_alignment: number;
    };
  };
  
  traffic_light_coordination: {
    current_phase: string;     // "north_south_green" | "east_west_green"
    phase_remaining: number;   // Seconds
    cycle_efficiency: number;  // 0.0-1.0
    
    optimization_metrics: {
      wait_time_reduction: number;    // Percentage
      throughput_improvement: number;
      energy_efficiency: number;
    };
    
    historical_performance: {
      avg_cycle_time: number;
      phase_distribution: {
        north_south: number;   // Percentage of time
        east_west: number;
      };
    };
  };
  
  flow_analysis: {
    total_hourly_vehicles: number;
    direction_breakdown: {
      direction: string;
      vehicle_count: number;
      percentage: number;
      peak_flow_rate: number;
    }[];
    
    flow_efficiency: {
      actual_throughput: number;
      theoretical_maximum: number;
      efficiency_percentage: number;
    };
    
    bottleneck_analysis: {
      has_bottleneck: boolean;
      bottleneck_direction?: string;
      severity: string;        // "minor" | "moderate" | "severe"
      estimated_delay: number; // Minutes
    };
  };
  
  weather_synchronization: WeatherState & {
    sync_quality: number;      // 0.0-1.0
    last_sync: string;
    consistency_across_sensors: number;
    
    weather_impact: {
      speed_adjustment_factor: number;
      visibility_impact: string;
      road_condition_alert: boolean;
    };
  };
}
```

### GET `/api/coordination/intersections/:id/weather-sync`

Weather synchronization analysis across intersection sensors.

**Response:**
```typescript
interface WeatherSyncResponse {
  intersection_id: string;
  
  weather_synchronization: {
    is_synchronized: boolean;
    sync_quality: number;      // 0.0-1.0
    last_sync_time: string;
    sync_radius_meters: number;
    
    master_weather_state: WeatherState;
    
    sensor_weather_data: {
      sensor_id: string;
      direction: string;
      weather_data: WeatherState;
      deviation_score: number; // How much it differs from master
      last_update: string;
    }[];
    
    consistency_metrics: {
      temperature_variance: number;
      humidity_variance: number;
      condition_agreement: number; // Percentage
      visibility_consistency: number;
    };
  };
  
  weather_impact_analysis: {
    traffic_speed_correlation: number;
    incident_probability_factor: number;
    light_cycle_adjustments: {
      current_adjustment: number; // Percentage of normal cycle
      reason: string;
    };
    
    safety_recommendations: {
      priority: string;
      action: string;
      description: string;
    }[];
  };
  
  historical_weather_patterns: {
    common_conditions: string[];
    transition_patterns: {
      from: string;
      to: string;
      avg_duration_minutes: number;
      frequency: number;
    }[];
  };
}
```

### GET `/api/coordination/intersections/:id/flow`

Flow tracking with granular time buckets and detailed analytics.

**Query Parameters:**
```typescript
interface FlowTrackingParams {
  granularity?: string;        // "5min" | "15min" | "1hour" (default: "15min")
  time_window?: number;        // Hours of data to include (default: 24)
  include_predictions?: boolean;
}
```

**Response:**
```typescript
interface FlowTrackingResponse {
  intersection_id: string;
  granularity: string;
  time_window_hours: number;
  
  flow_data: {
    time_bucket: string;       // "2024-01-15T14:15:00Z"
    period_minutes: number;
    
    total_flow: {
      vehicles: number;
      flow_rate: number;       // vehicles/minute
      throughput_efficiency: number; // 0.0-1.0
    };
    
    directional_flow: {
      direction: string;
      vehicle_count: number;
      flow_rate: number;
      avg_speed: number;
      queue_length: number;
      
      vehicle_types: {
        passenger_cars: number;
        commercial_vehicles: number;
        motorcycles: number;
        buses: number;
      };
    }[];
    
    coordination_metrics: {
      light_phase: string;
      phase_efficiency: number;
      wait_time_seconds: number;
      queue_clearance_rate: number;
    };
    
    environmental_factors: {
      weather_condition: string;
      temperature: number;
      visibility_meters: number;
      impact_on_flow: number;  // -1.0 to 1.0
    };
  }[];
  
  flow_analytics: {
    peak_periods: {
      start_time: string;
      end_time: string;
      peak_flow_rate: number;
      duration_minutes: number;
      primary_direction: string;
    }[];
    
    flow_patterns: {
      morning_rush: {
        start_hour: number;
        end_hour: number;
        avg_flow_rate: number;
        dominant_direction: string;
      };
      evening_rush: {
        start_hour: number;
        end_hour: number;
        avg_flow_rate: number;
        dominant_direction: string;
      };
      off_peak: {
        avg_flow_rate: number;
        consistency_score: number;
      };
    };
    
    efficiency_metrics: {
      overall_efficiency: number;
      best_performing_direction: string;
      worst_performing_direction: string;
      improvement_opportunities: string[];
    };
    
    predictive_insights?: {
      next_hour_prediction: {
        expected_flow_rate: number;
        confidence: number;
        primary_direction: string;
      };
      congestion_risk: {
        risk_level: string;
        time_to_congestion: number; // Minutes
        mitigation_suggestions: string[];
      };
    };
  };
}
```

---

## 🔧 Dashboard Integration Utilities

### Real-time Analytics Hooks

```typescript
// Risk Analysis Hook
const useRiskAnalysis = (intersectionId?: string) => {
  return useQuery({
    queryKey: ['risk-analysis', intersectionId],
    queryFn: async () => {
      const params = intersectionId ? `?intersection_id=${intersectionId}` : '';
      const response = await fetch(`/api/risk/analysis${params}`);
      return response.json() as RiskAnalysisResponse;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000       // Consider stale after 15 seconds
  });
};

// Historical Patterns Hook
const useHistoricalPatterns = (type: string, params: any) => {
  return useQuery({
    queryKey: ['historical', type, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams(params).toString();
      const response = await fetch(`/api/historical/${type}?${queryParams}`);
      return response.json();
    },
    staleTime: 300000 // Historical data is stable for 5 minutes
  });
};

// Coordination Status Hook
const useCoordinationStatus = (intersectionId: string) => {
  return useQuery({
    queryKey: ['coordination-status', intersectionId],
    queryFn: async () => {
      const response = await fetch(`/api/coordination/intersections/${intersectionId}/status`);
      return response.json() as IntersectionCoordinationStatus;
    },
    refetchInterval: 10000 // Refresh every 10 seconds for real-time coordination
  });
};
```

### Data Visualization Helpers

```typescript
// Risk Level Color Mapping
export const getRiskColor = (riskLevel: string): string => {
  const colors = {
    critical: '#dc2626',  // Red-600
    high: '#ea580c',      // Orange-600
    medium: '#ca8a04',    // Yellow-600
    low: '#16a34a'        // Green-600
  };
  return colors[riskLevel] || '#6b7280'; // Gray-500 for unknown
};

// Efficiency Score Formatting
export const formatEfficiency = (score: number): string => {
  return `${(score * 100).toFixed(1)}%`;
};

// Risk Score Badge Component
export const RiskScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  return (
    <span 
      className={`px-2 py-1 rounded text-xs font-medium`}
      style={{ backgroundColor: getRiskColor(level), color: 'white' }}
    >
      {score.toFixed(1)} ({level})
    </span>
  );
};
```

---

This documentation provides comprehensive coverage of all advanced analytics and intelligence features. The next section will cover real-time integration patterns and WebSocket streaming capabilities. 