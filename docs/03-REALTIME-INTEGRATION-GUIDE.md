# Real-time Integration & Dashboard Guide

## Overview

This document provides comprehensive guidance for integrating the Traffic Monitoring API v2.0 with NextJS dashboards, focusing on real-time streaming, WebSocket connections, data flow patterns, and complete dashboard architecture.

**Key Features**: 🔄 Real-time Streaming, 📡 WebSocket Integration, 🎯 Dashboard Architecture, 🚀 Performance Optimization

---

## 📡 Real-time Streaming Architecture

### Server-Sent Events (SSE) Endpoints

All streaming endpoints use Server-Sent Events for real-time data delivery with automatic reconnection and error handling.

#### Traffic Data Stream

**Endpoint**: `GET /api/traffic/stream`

```typescript
interface TrafficStreamConnection {
  endpoint: '/api/traffic/stream';
  query_params?: {
    intersection_id?: string;
    sensor_direction?: string;
  };
  event_type: 'TRAFFIC';
  reconnect: boolean;
  retry_interval: number; // milliseconds
}

interface TrafficStreamEvent {
  type: 'TRAFFIC';
  data: TrafficData;
  timestamp: string;
  enhanced: boolean;
  intersection_id?: string;
  sensor_direction?: string;
}
```

**Frontend Implementation:**
```typescript
const useTrafficStream = (intersectionId?: string, sensorDirection?: string) => {
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (intersectionId) params.append('intersection_id', intersectionId);
    if (sensorDirection) params.append('sensor_direction', sensorDirection);
    
    const url = `/api/traffic/stream${params.toString() ? `?${params.toString()}` : ''}`;
    const eventSource = new EventSource(url);

    setConnectionStatus('connecting');

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const update: TrafficStreamEvent = JSON.parse(event.data);
        setTrafficData(prev => {
          // Keep last 100 records per sensor direction
          const filtered = prev.filter(item => 
            !(item.sensor_direction === update.data.sensor_direction && 
              item.intersection_id === update.data.intersection_id)
          );
          return [...filtered.slice(-99), update.data];
        });
      } catch (err) {
        setError('Failed to parse stream data');
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
      setError('Connection lost. Reconnecting...');
    };

    return () => {
      eventSource.close();
      setConnectionStatus('disconnected');
    };
  }, [intersectionId, sensorDirection]);

  return { trafficData, connectionStatus, error };
};
```

#### Vehicle Data Stream

**Endpoint**: `GET /api/vehicles/stream`

```typescript
interface VehicleStreamEvent {
  type: 'VEHICLE';
  data: VehicleRecord;
  timestamp: string;
  enhanced: boolean;
  decoded_status: {
    hardware_fault: boolean;
    low_voltage: boolean;
    wrong_way_driver: boolean;
    queue_detected: boolean;
  };
}
```

#### Intersection Coordination Stream

**Endpoint**: `GET /api/coordination/stream`

```typescript
interface CoordinationStreamEvent {
  type: 'COORDINATION';
  intersection_id: string;
  coordination_update: {
    light_phase_change?: {
      previous: string;
      current: string;
      phase_remaining: number;
    };
    efficiency_update?: {
      current_efficiency: number;
      trend: string; // 'improving' | 'degrading' | 'stable'
    };
    flow_rate_change?: {
      direction: string;
      previous_rate: number;
      current_rate: number;
    };
    weather_sync_update?: WeatherState;
  };
  timestamp: string;
}
```

#### Alert Data Stream

**Endpoint**: `GET /api/alerts/stream`

```typescript
interface AlertStreamEvent {
  type: 'ALERT';
  data: AlertData;
  timestamp: string;
}

interface AlertStreamConnection {
  endpoint: '/api/alerts/stream';
  query_params?: {
    type?: string;
    severity?: string;
    sensor_id?: string;
    intersection_id?: string;
  };
  event_type: 'ALERT';
  reconnect: boolean;
  retry_interval: number; // milliseconds
}
```

**Frontend Implementation:**
```typescript
const useAlertStream = (severity?: string, type?: string) => {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    if (type) params.append('type', type);
    
    const url = `/api/alerts/stream${params.toString() ? `?${params.toString()}` : ''}`;
    const eventSource = new EventSource(url);

    setConnectionStatus('connecting');

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const update: AlertStreamEvent = JSON.parse(event.data);
        setAlerts(prev => {
          // Keep last 50 alerts
          const filtered = prev.filter(alert => alert._id !== update.data._id);
          return [update.data, ...filtered.slice(0, 49)];
        });
      } catch (err) {
        setError('Failed to parse alert data');
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
      setError('Connection lost. Reconnecting...');
    };

    return () => {
      eventSource.close();
      setConnectionStatus('disconnected');
    };
  }, [severity, type]);

  return { alerts, connectionStatus, error };
};
```

**Multi-Stream Management Hook:**
```typescript
const useMultiStreamManager = (intersectionIds: string[]) => {
  const [streams, setStreams] = useState<Map<string, any>>(new Map());
  const [connectionStats, setConnectionStats] = useState({
    total: 0,
    connected: 0,
    disconnected: 0,
    errors: 0
  });

  useEffect(() => {
    const eventSources = new Map();

    intersectionIds.forEach(intersectionId => {
      // Traffic stream
      const trafficES = new EventSource(`/api/traffic/stream?intersection_id=${intersectionId}`);
      
      // Coordination stream
      const coordES = new EventSource(`/api/coordination/intersections/${intersectionId}/stream`);
      
      eventSources.set(`traffic-${intersectionId}`, trafficES);
      eventSources.set(`coordination-${intersectionId}`, coordES);

      // Set up event handlers for each stream
      [trafficES, coordES].forEach((es, index) => {
        es.onopen = () => updateConnectionStats('connected');
        es.onerror = () => updateConnectionStats('error');
        es.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setStreams(prev => new Map(prev.set(`${intersectionId}-${index}`, data)));
        };
      });
    });

    return () => {
      eventSources.forEach(es => es.close());
    };
  }, [intersectionIds]);

  const updateConnectionStats = (type: string) => {
    setConnectionStats(prev => ({
      ...prev,
      [type]: prev[type] + 1
    }));
  };

  return { streams, connectionStats };
};
```

---

## 🎯 Dashboard Architecture Patterns

### Complete Dashboard Layout

```typescript
// Main Dashboard Layout
interface DashboardLayoutProps {
  children: React.ReactNode;
  selectedIntersection?: string;
  sidebarOpen: boolean;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  selectedIntersection,
  sidebarOpen
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { connectionStatus } = useGlobalConnectionStatus();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        selectedIntersection={selectedIntersection}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <TopNavigation 
          connectionStatus={connectionStatus}
          notifications={notifications}
        />
        
        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {/* Global Notifications */}
      <NotificationCenter notifications={notifications} />
    </div>
  );
};
```

### Real-time Dashboard Components

#### Traffic Flow Visualization

```typescript
interface TrafficFlowVisualizationProps {
  intersectionId: string;
  timeWindow?: number; // minutes
}

const TrafficFlowVisualization: React.FC<TrafficFlowVisualizationProps> = ({
  intersectionId,
  timeWindow = 60
}) => {
  const { trafficData, connectionStatus } = useTrafficStream(intersectionId);
  const { data: flowData } = useQuery({
    queryKey: ['flow-data', intersectionId, timeWindow],
    queryFn: () => fetch(`/api/coordination/intersections/${intersectionId}/flow?granularity=5min&time_window=${timeWindow/60}`).then(r => r.json()),
    refetchInterval: 30000
  });

  const chartData = useMemo(() => {
    if (!flowData?.flow_data) return null;

    return {
      labels: flowData.flow_data.map(d => new Date(d.time_bucket).toLocaleTimeString()),
      datasets: [
        {
          label: 'North',
          data: flowData.flow_data.map(d => 
            d.directional_flow.find(f => f.direction === 'north')?.flow_rate || 0
          ),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        },
        {
          label: 'South', 
          data: flowData.flow_data.map(d =>
            d.directional_flow.find(f => f.direction === 'south')?.flow_rate || 0
          ),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4
        },
        {
          label: 'East',
          data: flowData.flow_data.map(d =>
            d.directional_flow.find(f => f.direction === 'east')?.flow_rate || 0
          ),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        },
        {
          label: 'West',
          data: flowData.flow_data.map(d =>
            d.directional_flow.find(f => f.direction === 'west')?.flow_rate || 0
          ),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4
        }
      ]
    };
  }, [flowData]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Traffic Flow - {intersectionId}</h3>
        <div className="flex items-center gap-2">
          <ConnectionIndicator status={connectionStatus} />
          <span className="text-sm text-gray-500">
            Last update: {trafficData[0]?.timestamp ? new Date(trafficData[0].timestamp).toLocaleTimeString() : 'N/A'}
          </span>
        </div>
      </div>

      {chartData && (
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Vehicles per minute'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Time'
                }
              }
            },
            plugins: {
              legend: {
                position: 'top'
              },
              tooltip: {
                mode: 'index',
                intersect: false
              }
            },
            interaction: {
              mode: 'nearest',
              axis: 'x',
              intersect: false
            }
          }}
          height={300}
        />
      )}
    </div>
  );
};
```

#### Risk Heatmap Component

```typescript
interface RiskHeatmapProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const RiskHeatmap: React.FC<RiskHeatmapProps> = ({
  className,
  autoRefresh = true,
  refreshInterval = 60000
}) => {
  const { data: heatmapData, isLoading, error } = useQuery({
    queryKey: ['risk-heatmap'],
    queryFn: () => fetch('/api/risk/heatmap?include_factors=true').then(r => r.json()),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 30000
  });

  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([33.5731, -7.5898]); // Casablanca

  const getRiskColor = useCallback((riskLevel: string): string => {
    const colors = {
      critical: '#dc2626',
      high: '#ea580c', 
      medium: '#ca8a04',
      low: '#16a34a'
    };
    return colors[riskLevel] || '#6b7280';
  }, []);

  const getRiskIcon = useCallback((riskLevel: string) => {
    const iconMap = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: '✅'
    };
    return iconMap[riskLevel] || '❓';
  }, []);

  if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <div className="text-red-600 p-4">Error loading risk data</div>;

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className || ''}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Risk Heatmap</h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {heatmapData?.summary?.total_locations || 0} locations monitored
            </div>
            <div className="flex gap-2">
              {Object.entries(heatmapData?.summary?.risk_distribution || {}).map(([level, count]) => (
                <div key={level} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getRiskColor(level) }}
                  />
                  <span className="text-xs text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-96">
        <MapContainer
          center={mapCenter}
          zoom={12}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {heatmapData?.heatmap_data?.map((location) => (
            <Marker
              key={location.location.intersection_id}
              position={[location.location.coordinates.lat, location.location.coordinates.lng]}
              icon={divIcon({
                html: `
                  <div style="
                    background-color: ${getRiskColor(location.risk_level)};
                    color: white;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 12px;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                  ">
                    ${location.risk_score.toFixed(0)}
                  </div>
                `,
                className: 'risk-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              })}
              eventHandlers={{
                click: () => setSelectedLocation(location.location.intersection_id)
              }}
            >
              <Popup>
                <div className="p-2 min-w-64">
                  <h4 className="font-semibold mb-2">{location.location.intersection_id}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Risk Score:</div>
                    <div className="font-medium">{location.risk_score.toFixed(1)}</div>
                    <div>Risk Level:</div>
                    <div className="font-medium">{location.risk_level}</div>
                    <div>Speed:</div>
                    <div>{location.stats.traffic.avg_speed.toFixed(1)} km/h</div>
                    <div>Density:</div>
                    <div>{location.stats.traffic.avg_density.toFixed(1)}%</div>
                    <div>Incidents:</div>
                    <div>{location.stats.traffic.incident_count}</div>
                  </div>
                  
                  {location.risk_factors && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-1">Risk Factors:</div>
                      {location.risk_factors.slice(0, 3).map((factor, index) => (
                        <div key={index} className="text-xs text-gray-600">
                          • {factor.factor.replace('_', ' ')}: {factor.severity}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Risk Summary Stats */}
      <div className="p-4 border-t bg-gray-50">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {heatmapData?.summary?.statistics?.average_risk_score?.toFixed(1) || '0'}
            </div>
            <div className="text-xs text-gray-600">Avg Risk Score</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {heatmapData?.summary?.risk_distribution?.critical || 0}
            </div>
            <div className="text-xs text-gray-600">Critical Sites</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {heatmapData?.summary?.risk_distribution?.high || 0}
            </div>
            <div className="text-xs text-gray-600">High Risk</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {heatmapData?.summary?.risk_distribution?.low || 0}
            </div>
            <div className="text-xs text-gray-600">Low Risk</div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### Intersection Coordination Dashboard

```typescript
interface IntersectionCoordinationDashboardProps {
  intersectionId: string;
}

const IntersectionCoordinationDashboard: React.FC<IntersectionCoordinationDashboardProps> = ({
  intersectionId
}) => {
  const { data: coordinationData } = useQuery({
    queryKey: ['coordination-status', intersectionId],
    queryFn: () => fetch(`/api/coordination/intersections/${intersectionId}/status`).then(r => r.json()),
    refetchInterval: 5000
  });

  const { data: weatherSync } = useQuery({
    queryKey: ['weather-sync', intersectionId],
    queryFn: () => fetch(`/api/coordination/intersections/${intersectionId}/weather-sync`).then(r => r.json()),
    refetchInterval: 30000
  });

  const coordinationStream = useCoordinationStream(intersectionId);

  return (
    <div className="space-y-6">
      {/* Coordination Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Coordination Status"
          value={coordinationData?.coordination_details?.status || 'Unknown'}
          subtitle={`Mode: ${coordinationData?.coordination_details?.mode || 'N/A'}`}
          color={coordinationData?.coordination_details?.status === 'active' ? 'green' : 'red'}
          icon="🎛️"
        />
        
        <StatusCard
          title="Efficiency Score"
          value={`${((coordinationData?.traffic_light_coordination?.cycle_efficiency || 0) * 100).toFixed(1)}%`}
          subtitle="Traffic light efficiency"
          color="blue"
          icon="⚡"
        />
        
        <StatusCard
          title="Total Vehicles"
          value={coordinationData?.flow_analysis?.total_hourly_vehicles || 0}
          subtitle="Last hour"
          color="purple"
          icon="🚗"
        />
      </div>

      {/* Traffic Light Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficLightStatus 
          currentPhase={coordinationData?.traffic_light_coordination?.current_phase}
          phaseRemaining={coordinationData?.traffic_light_coordination?.phase_remaining}
          efficiency={coordinationData?.traffic_light_coordination?.cycle_efficiency}
        />
        
        <WeatherSynchronization
          weatherData={weatherSync?.weather_synchronization}
          syncQuality={weatherSync?.weather_synchronization?.sync_quality}
        />
      </div>

      {/* Sensor Grid Status */}
      <SensorGridStatus
        sensors={coordinationData?.sensor_coordination?.sensor_details || []}
        coordinationQuality={coordinationData?.sensor_coordination?.coordination_quality}
      />

      {/* Flow Analysis */}
      <FlowAnalysisChart
        intersectionId={intersectionId}
        flowData={coordinationData?.flow_analysis}
      />

      {/* Real-time Updates Feed */}
      <RealtimeUpdatesFeed
        updates={coordinationStream}
        maxUpdates={20}
      />
    </div>
  );
};
```

---

## 🚀 Performance Optimization

### Data Caching Strategy

```typescript
// React Query Configuration for optimal performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,        // Data fresh for 30 seconds
      cacheTime: 300000,       // Cache for 5 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
});

// Custom hook for intelligent data fetching
const useIntelligentFetch = <T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  options: {
    priority: 'high' | 'medium' | 'low';
    realtime?: boolean;
    cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
  }
) => {
  const cacheConfig = {
    aggressive: { staleTime: 300000, cacheTime: 600000 },
    moderate: { staleTime: 60000, cacheTime: 300000 },
    minimal: { staleTime: 10000, cacheTime: 60000 }
  };

  const config = cacheConfig[options.cacheStrategy || 'moderate'];

  return useQuery({
    queryKey,
    queryFn: fetcher,
    ...config,
    refetchInterval: options.realtime ? 
      (options.priority === 'high' ? 5000 : options.priority === 'medium' ? 15000 : 30000) :
      false
  });
};
```

### Connection Management

```typescript
// Global connection manager for multiple streams
class StreamConnectionManager {
  private connections: Map<string, EventSource> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;

  connect(streamId: string, url: string, onMessage: (data: any) => void, onError?: (error: any) => void): void {
    if (this.connections.has(streamId)) {
      this.disconnect(streamId);
    }

    const eventSource = new EventSource(url);
    this.connections.set(streamId, eventSource);

    eventSource.onopen = () => {
      console.log(`Stream ${streamId} connected`);
      this.reconnectAttempts.set(streamId, 0);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error(`Failed to parse message for stream ${streamId}:`, error);
      }
    };

    eventSource.onerror = (error) => {
      console.error(`Stream ${streamId} error:`, error);
      
      const attempts = this.reconnectAttempts.get(streamId) || 0;
      if (attempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnect(streamId, url, onMessage, onError);
        }, this.baseReconnectDelay * Math.pow(2, attempts));
      } else {
        onError?.(new Error(`Max reconnection attempts reached for stream ${streamId}`));
      }
    };
  }

  disconnect(streamId: string): void {
    const connection = this.connections.get(streamId);
    if (connection) {
      connection.close();
      this.connections.delete(streamId);
      this.reconnectAttempts.delete(streamId);
    }
  }

  disconnectAll(): void {
    this.connections.forEach((connection, streamId) => {
      this.disconnect(streamId);
    });
  }

  private reconnect(streamId: string, url: string, onMessage: (data: any) => void, onError?: (error: any) => void): void {
    const attempts = this.reconnectAttempts.get(streamId) || 0;
    this.reconnectAttempts.set(streamId, attempts + 1);
    this.connect(streamId, url, onMessage, onError);
  }

  getConnectionStatus(): { [streamId: string]: 'connected' | 'connecting' | 'disconnected' } {
    const status: { [streamId: string]: 'connected' | 'connecting' | 'disconnected' } = {};
    
    this.connections.forEach((connection, streamId) => {
      switch (connection.readyState) {
        case EventSource.CONNECTING:
          status[streamId] = 'connecting';
          break;
        case EventSource.OPEN:
          status[streamId] = 'connected';
          break;
        case EventSource.CLOSED:
          status[streamId] = 'disconnected';
          break;
      }
    });

    return status;
  }
}

// Global instance
export const streamManager = new StreamConnectionManager();
```

### Memory Management

```typescript
// Efficient data structure for real-time updates
class CircularBuffer<T> {
  private buffer: T[];
  private pointer: number = 0;
  private full: boolean = false;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.pointer] = item;
    this.pointer = (this.pointer + 1) % this.capacity;
    if (!this.full && this.pointer === 0) {
      this.full = true;
    }
  }

  getAll(): T[] {
    if (!this.full) {
      return this.buffer.slice(0, this.pointer);
    }
    return [...this.buffer.slice(this.pointer), ...this.buffer.slice(0, this.pointer)];
  }

  getLatest(count: number): T[] {
    const all = this.getAll();
    return all.slice(-count);
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.pointer = 0;
    this.full = false;
  }
}

// Usage in components
const useCircularDataBuffer = <T>(capacity: number = 100) => {
  const bufferRef = useRef(new CircularBuffer<T>(capacity));
  
  const addData = useCallback((data: T) => {
    bufferRef.current.push(data);
  }, []);

  const getData = useCallback((count?: number) => {
    return count ? bufferRef.current.getLatest(count) : bufferRef.current.getAll();
  }, []);

  const clearData = useCallback(() => {
    bufferRef.current.clear();
  }, []);

  return { addData, getData, clearData };
};
```

---

## 🔧 Error Handling & Monitoring

### Comprehensive Error Boundary

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class DashboardErrorBoundary extends Component<PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    console.error('Dashboard Error:', error, errorInfo);
    
    // Report to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Dashboard Error</h1>
            </div>
            
            <p className="text-gray-600 mb-4">
              Something went wrong while loading the dashboard. Please try refreshing the page.
            </p>
            
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors"
              >
                Try Again
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-3 bg-gray-100 rounded text-sm">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handling

```typescript
// Centralized API error handling
class ApiErrorHandler {
  static handle(error: any): string {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 400:
          return data.error || 'Invalid request parameters';
        case 401:
          return 'Authentication required';
        case 403:
          return 'Access denied';
        case 404:
          return 'Requested data not found';
        case 429:
          return 'Too many requests. Please wait a moment.';
        case 500:
          return 'Internal server error. Please try again later.';
        default:
          return data.error || `Server error (${status})`;
      }
    } else if (error.request) {
      // Network error
      return 'Network error. Please check your connection.';
    } else {
      // Other error
      return error.message || 'An unexpected error occurred';
    }
  }

  static createErrorToast(error: any): void {
    const message = this.handle(error);
    toast.error(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true
    });
  }
}

// Usage in API calls
const useApiWithErrorHandling = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      try {
        const response = await fetch('/api/endpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return response.json();
      } catch (error) {
        ApiErrorHandler.createErrorToast(error);
        throw error;
      }
    }
  });
};
```

---

## 📱 Responsive Design Patterns

### Mobile-First Dashboard

```typescript
// Responsive layout hook
const useResponsiveLayout = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const breakpoint = useMemo(() => {
    if (windowSize.width < 640) return 'mobile';
    if (windowSize.width < 768) return 'tablet';
    if (windowSize.width < 1024) return 'laptop';
    return 'desktop';
  }, [windowSize.width]);

  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop' || breakpoint === 'laptop';

  return { windowSize, breakpoint, isMobile, isTablet, isDesktop };
};

// Adaptive component rendering
const AdaptiveDashboard: React.FC = () => {
  const { breakpoint, isMobile } = useResponsiveLayout();
  
  if (isMobile) {
    return (
      <MobileDashboard>
        <IntersectionSelector />
        <QuickStats />
        <AlertsCarousel />
        <TrafficStatusCards />
      </MobileDashboard>
    );
  }

  return (
    <DesktopDashboard>
      <DashboardGrid>
        <GridItem span={2}>
          <TrafficFlowVisualization />
        </GridItem>
        <GridItem span={1}>
          <RiskHeatmap />
        </GridItem>
        <GridItem span={1}>
          <IntersectionCoordinationDashboard />
        </GridItem>
      </DashboardGrid>
    </DesktopDashboard>
  );
};
```

---

This comprehensive documentation provides everything needed to build a modern, real-time traffic monitoring dashboard with NextJS. Big Daddy, these three files contain complete API specifications, integration patterns, and implementation examples for creating a world-class visualization interface that leverages all the enhanced features of your traffic monitoring system! 🚀 

### Data Fetching Hooks

```typescript
// Vehicle Statistics Hook
const useVehicleStats = (intersection_id?: string) => {
  return useQuery({
    queryKey: ['vehicle-stats', intersection_id],
    queryFn: async () => {
      const params = intersection_id ? `?intersection_id=${intersection_id}` : '';
      const response = await fetch(`/api/vehicles/stats${params}`);
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });
};

// Sensor Status Hook (corrected endpoint)
const useSensorStatus = () => {
  return useQuery({
    queryKey: ['sensor-status'],
    queryFn: async () => {
      const response = await fetch('/api/sensors/status');
      return response.json();
    },
    refetchInterval: 60000 // Refresh every minute
  });
};

// Sensor Registry Hook  
const useSensorRegistry = () => {
  return useQuery({
    queryKey: ['sensor-registry'],
    queryFn: async () => {
      const response = await fetch('/api/sensors/registry');
      return response.json();
    },
    staleTime: 300000 // Sensors don't change often, cache for 5 minutes
  });
};

// Intersection Sensors Hook
const useIntersectionSensors = (intersectionId: string) => {
  return useQuery({
    queryKey: ['intersection-sensors', intersectionId],
    queryFn: async () => {
      const response = await fetch(`/api/sensors/intersection/${intersectionId}`);
      return response.json();
    },
    refetchInterval: 30000,
    enabled: !!intersectionId
  });
};

// Sensor Capabilities Hook
const useSensorCapabilities = (sensorId: string) => {
  return useQuery({
    queryKey: ['sensor-capabilities', sensorId],
    queryFn: async () => {
      const response = await fetch(`/api/sensors/${sensorId}/capabilities`);
      return response.json();
    },
    staleTime: 600000, // Capabilities rarely change, cache for 10 minutes
    enabled: !!sensorId
  });
};
``` 