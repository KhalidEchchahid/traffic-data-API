const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const StreamService = require("../services/streamService")
const config = require("../config/config")

// Enhanced vehicle length specifications from new Rust simulator
const ENHANCED_VEHICLE_LENGTHS = {
  passenger_car: "30-45 dm",    // 3.0-4.5 meters
  suv: "45-55 dm",              // 4.5-5.5 meters  
  pickup_truck: "50-65 dm",     // 5.0-6.5 meters
  motorcycle: "15-25 dm",       // 1.5-2.5 meters
  bus: "100-140 dm",            // 10.0-14.0 meters
  semi_truck: "150-220 dm",     // 15.0-22.0 meters
  delivery_van: "55-75 dm"      // 5.5-7.5 meters
}

// Enhanced status byte decoding from new Rust simulator
function decodeVehicleStatus(status) {
  return {
    hardware_fault: (status & 0x04) !== 0,
    low_voltage: (status & 0x08) !== 0,
    wrong_way_driver: (status & 0x10) !== 0,
    queue_detected: (status & 0x20) !== 0
  }
}

// Helper function to detect enhanced vehicle records
function isEnhancedVehicleRecord(record) {
  return !!(record.intersection_id || record.sensor_direction || record.coordinated_weather)
}

// Get all vehicle records with enhanced pagination and filtering
router.get("/", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== ENHANCED VEHICLE RECORDS REQUEST ===")
    const collection = await db.getCollection(config.VEHICLE_COLLECTION)
    const { 
      page = 1, 
      limit = 50, 
      sensor_id, 
      intersection_id,
      sensor_direction,
      vehicle_class,
      weather_condition,
      start, 
      end 
    } = req.query

    console.log("Query parameters:", { page, limit, sensor_id, intersection_id, sensor_direction, vehicle_class, weather_condition, start, end })

    const filter = {}

    // Enhanced filtering capabilities
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }

    // NEW: Filter by intersection (from enhanced data)
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }

    // NEW: Filter by sensor direction (from enhanced data)
    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Filter by vehicle class
    if (vehicle_class) {
      filter.vehicle_class = vehicle_class
    }

    // NEW: Filter by weather condition (from enhanced coordinated weather)
    if (weather_condition) {
      filter["coordinated_weather.conditions"] = weather_condition
    }

    // Enhanced time range filtering with proper date handling
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        filter.timestamp.$gte = new Date(start)
      }
      if (end) {
        filter.timestamp.$lte = new Date(end)
      }
    }

    console.log("Applied filter:", JSON.stringify(filter, null, 2))

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    // Check if collection exists and has data
    const collectionExists = await collection.countDocuments({})
    console.log(`Vehicle collection document count: ${collectionExists}`)

    if (collectionExists === 0) {
      console.log("⚠️ Vehicle collection is empty - returning empty result with enhanced metadata")
      return res.json({
        data: [],
        pagination: {
          total: 0,
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          pages: 0,
        },
        metadata: {
          enhanced_records: 0,
          legacy_records: 0,
          data_sources: {
            enhanced: 0,
            legacy: 0
          },
          enhancement_rate: 0
        },
        filters_applied: {
          sensor_id: sensor_id || null,
          intersection_id: intersection_id || null,
          sensor_direction: sensor_direction || null,
          vehicle_class: vehicle_class || null,
          weather_condition: weather_condition || null,
          time_range: {
            start: start || null,
            end: end || null
          }
        },
        message: "Vehicle collection is empty. No vehicle data available yet.",
        enhanced_features_available: [
          "intersection_coordination",
          "weather_synchronization", 
          "enhanced_status_decoding",
          "precise_length_specifications"
        ]
      })
    }

    // FIXED: Simplified query without problematic $bitAnd aggregation
    console.log("Fetching vehicle records with simple query...")
    const data = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .toArray()

    console.log(`Found ${data.length} vehicle records`)

    // Get total count with same filter
    const total = await collection.countDocuments(filter)
    console.log(`Total matching records: ${total}`)

    // Enhance data with JavaScript-based processing (MongoDB version compatible)
    const enhancedData = data.map(record => {
      // Enhanced status decoding (done in JavaScript instead of MongoDB aggregation)
      let decoded_status = null
      if (record.status !== null && record.status !== undefined) {
        decoded_status = decodeVehicleStatus(record.status)
      }

      // Enhanced vehicle length information
      const enhanced_length_info = ENHANCED_VEHICLE_LENGTHS[record.vehicle_class] || "Unknown vehicle type"

      // Mark as enhanced or legacy
      const data_source = (record.intersection_id || record.sensor_direction || record.coordinated_weather) ? "enhanced" : "legacy"

      return {
        ...record,
        decoded_status,
        enhanced_length_info: enhanced_length_info + " (" + enhanced_length_info.split(" ")[0].replace("dm", "m").replace("-", "m-") + ")",
        data_source
      }
    })

    // Enhanced metadata about the result set
    const enhancedCount = enhancedData.filter(record => record.data_source === "enhanced").length
    const legacyCount = enhancedData.filter(record => record.data_source === "legacy").length

    const response = {
      data: enhancedData,
      pagination: {
        total,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
      metadata: {
        enhanced_records: enhancedCount,
        legacy_records: legacyCount,
        data_sources: {
          enhanced: enhancedCount,
          legacy: legacyCount
        },
        enhancement_rate: enhancedData.length > 0 ? Math.round((enhancedCount / enhancedData.length) * 100) : 0
      },
      filters_applied: {
        sensor_id: sensor_id || null,
        intersection_id: intersection_id || null,
        sensor_direction: sensor_direction || null,
        vehicle_class: vehicle_class || null,
        weather_condition: weather_condition || null,
        time_range: {
          start: start || null,
          end: end || null
        }
      }
    }

    console.log("=== ENHANCED VEHICLE RECORDS SUCCESS ===")
    console.log(`Returning ${enhancedData.length} records (${enhancedCount} enhanced, ${legacyCount} legacy)`)
    res.json(response)
  } catch (error) {
    console.error("=== ENHANCED VEHICLE RECORDS ERROR ===")
    console.error("DB Error:", error)
    res.status(500).json({ 
      error: "Failed to fetch vehicle records",
      details: error.message 
    })
  }
})

// Enhanced vehicle statistics with intersection coordination and weather correlation
router.get("/stats", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== ENHANCED VEHICLE STATS REQUEST ===")
    const collection = await db.getCollection(config.VEHICLE_COLLECTION)
    const { sensor_id, intersection_id, sensor_direction, start, end } = req.query

    console.log("Stats query parameters:", { sensor_id, intersection_id, sensor_direction, start, end })

    const filter = {}

    // Enhanced filtering
    if (sensor_id) {
      filter.sensor_id = sensor_id
    }
    if (intersection_id) {
      filter.intersection_id = intersection_id
    }
    if (sensor_direction) {
      filter.sensor_direction = sensor_direction
    }

    // Time range filtering
    if (start || end) {
      filter.timestamp = {}
      if (start) {
        filter.timestamp.$gte = new Date(start)
      }
      if (end) {
        filter.timestamp.$lte = new Date(end)
      }
    }

    console.log("Stats filter:", JSON.stringify(filter, null, 2))

    // Enhanced vehicle class statistics with intersection and weather correlation
    const vehicleClassPipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$vehicle_class",
          count: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          avgOccupancy: { $avg: "$occupancy_s" },
          avgTimeGap: { $avg: "$time_gap_s" },
          // NEW: Enhanced statistics from new simulator - Fixed to exclude null values
          intersections: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$intersection_id", null] },
                  { $ne: ["$intersection_id", ""] }
                ]},
                "$intersection_id",
                "$$REMOVE"
              ]
            }
          },
          weatherConditions: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$coordinated_weather.conditions", null] },
                  { $ne: ["$coordinated_weather.conditions", ""] }
                ]},
                "$coordinated_weather.conditions",
                "$$REMOVE"
              ]
            }
          },
          sensorDirections: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$sensor_direction", null] },
                  { $ne: ["$sensor_direction", ""] }
                ]},
                "$sensor_direction",
                "$$REMOVE"
              ]
            }
          },
        },
      },
      { $sort: { count: -1 } },
    ]

    console.log("Getting vehicle class stats...")
    const vehicleClassStats = await collection.aggregate(vehicleClassPipeline).toArray()
    console.log(`Vehicle class stats: ${vehicleClassStats.length} classes`)

    // Enhanced overall statistics
    const overallPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalVehicles: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          maxSpeed: { $max: "$speed_kmh" },
          minSpeed: { $min: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          maxLength: { $max: "$length_dm" },
          minLength: { $min: "$length_dm" },
          // Enhanced status byte statistics (simplified)
          totalWithStatus: {
            $sum: {
              $cond: [{ $ne: ["$status", null] }, 1, 0],
            },
          },
          // NEW: Enhanced coordination statistics - Fixed to exclude null values
          uniqueIntersections: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$intersection_id", null] },
                  { $ne: ["$intersection_id", ""] }
                ]},
                "$intersection_id",
                "$$REMOVE"
              ]
            }
          },
          uniqueSensorDirections: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$sensor_direction", null] },
                  { $ne: ["$sensor_direction", ""] }
                ]},
                "$sensor_direction",
                "$$REMOVE"
              ]
            }
          },
          enhancedRecords: {
            $sum: {
              $cond: [
                { 
                  $or: [
                    { $ne: ["$intersection_id", null] },
                    { $ne: ["$coordinated_weather", null] }
                  ]
                }, 
                1, 
                0
              ]
            }
          }
        },
      },
    ]

    console.log("Getting overall stats...")
    const overallStatsResult = await collection.aggregate(overallPipeline).toArray()
    const overallStats = overallStatsResult[0] || {}
    console.log("Overall stats calculated")

    // Enhanced time distribution with proper timestamp handling
    console.log("Getting hourly time distribution...")
    const timeDistributionPipeline = [
      { $match: filter },
      {
        $addFields: {
          timestampDate: {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $type: "$timestamp" }, "date"] },
                  then: "$timestamp"
                },
                {
                  case: { $eq: [{ $type: "$timestamp" }, "string"] },
                  then: {
                    $dateFromString: { 
                      dateString: "$timestamp",
                      onError: new Date() // Fallback to current date if parsing fails
                    }
                  }
                }
              ],
              default: new Date() // Fallback for any other type
            }
          }
        }
      },
      {
        $group: {
          _id: { $hour: "$timestampDate" },
          count: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          uniqueVehicleClasses: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$vehicle_class", null] },
                  { $ne: ["$vehicle_class", ""] }
                ]},
                "$vehicle_class",
                "$$REMOVE"
              ]
            }
          },
          weatherConditions: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$coordinated_weather.conditions", null] },
                  { $ne: ["$coordinated_weather.conditions", ""] }
                ]},
                "$coordinated_weather.conditions",
                "$$REMOVE"
              ]
            }
          }
        },
      },
      { $sort: { _id: 1 } },
    ]

    const timeDistribution = await collection.aggregate(timeDistributionPipeline).toArray()
    console.log(`Time distribution: ${timeDistribution.length} hours`)

    // NEW: Weather correlation analysis (enhanced feature) - Fixed to exclude null values
    const weatherCorrelationPipeline = [
      { $match: { ...filter, "coordinated_weather.conditions": { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$coordinated_weather.conditions",
          count: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          avgTemperature: { $avg: "$coordinated_weather.temperature" },
          avgHumidity: { $avg: "$coordinated_weather.humidity" },
          vehicleClasses: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$vehicle_class", null] },
                  { $ne: ["$vehicle_class", ""] }
                ]},
                "$vehicle_class",
                "$$REMOVE"
              ]
            }
          },
          roadConditions: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$coordinated_weather.road_condition", null] },
                  { $ne: ["$coordinated_weather.road_condition", ""] }
                ]},
                "$coordinated_weather.road_condition",
                "$$REMOVE"
              ]
            }
          }
        },
      },
      { $sort: { count: -1 } },
    ]

    console.log("Getting weather correlation...")
    const weatherCorrelation = await collection.aggregate(weatherCorrelationPipeline).toArray()
    console.log(`Weather correlation: ${weatherCorrelation.length} conditions`)

    // NEW: Intersection coordination statistics - Fixed to exclude null values
    const intersectionStatsPipeline = [
      { $match: { ...filter, intersection_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            intersection_id: "$intersection_id",
            sensor_direction: "$sensor_direction"
          },
          count: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          vehicleClasses: { 
            $addToSet: {
              $cond: [
                { $and: [
                  { $ne: ["$vehicle_class", null] },
                  { $ne: ["$vehicle_class", ""] }
                ]},
                "$vehicle_class",
                "$$REMOVE"
              ]
            }
          },
          avgOccupancy: { $avg: "$occupancy_s" },
          avgTimeGap: { $avg: "$time_gap_s" }
        },
      },
      { $sort: { count: -1 } },
    ]

    console.log("Getting intersection stats...")
    const intersectionStats = await collection.aggregate(intersectionStatsPipeline).toArray()
    console.log(`Intersection stats: ${intersectionStats.length} intersection-direction combinations`)

    // Clean up data for response - No longer need JavaScript filtering since DB handles nulls
    const cleanOverallStats = {
      ...overallStats,
      uniqueIntersections: overallStats.uniqueIntersections || [],
      uniqueSensorDirections: overallStats.uniqueSensorDirections || [],
      enhancementRate: overallStats.totalVehicles > 0 ? 
        Math.round((overallStats.enhancedRecords / overallStats.totalVehicles) * 100) : 0
    }

    const response = {
      vehicleClassStats: vehicleClassStats.map(stat => ({
        ...stat,
        intersections: stat.intersections || [],
        weatherConditions: stat.weatherConditions || [],
        sensorDirections: stat.sensorDirections || [],
        enhancedLengthRange: ENHANCED_VEHICLE_LENGTHS[stat._id] || "Unknown"
      })),
      overallStats: cleanOverallStats,
      timeDistribution: timeDistribution.map(item => ({
        hour: item._id,
        count: item.count,
        avgSpeed: item.avgSpeed,
        avgLength: item.avgLength,
        uniqueVehicleClasses: item.uniqueVehicleClasses || [],
        weatherConditions: item.weatherConditions || []
      })),
      // NEW: Enhanced analytics from intersection coordination
      enhancedAnalytics: {
        weatherCorrelation: weatherCorrelation.map(item => ({
          weather_condition: item._id,
          count: item.count,
          avgSpeed: item.avgSpeed,
          avgLength: item.avgLength,
          avgTemperature: item.avgTemperature,
          avgHumidity: item.avgHumidity,
          vehicleClasses: item.vehicleClasses || [],
          roadConditions: item.roadConditions || []
        })),
        intersectionStats: intersectionStats.map(item => ({
          intersection_id: item._id.intersection_id,
          sensor_direction: item._id.sensor_direction,
          count: item.count,
          avgSpeed: item.avgSpeed,
          avgLength: item.avgLength,
          vehicleClasses: item.vehicleClasses || [],
          avgOccupancy: item.avgOccupancy,
          avgTimeGap: item.avgTimeGap
        })),
        dataSourceBreakdown: {
          total: overallStats.totalVehicles || 0,
          enhanced: overallStats.enhancedRecords || 0,
          legacy: (overallStats.totalVehicles || 0) - (overallStats.enhancedRecords || 0),
          enhancement_rate: cleanOverallStats.enhancementRate
        }
      }
    }

    console.log("=== ENHANCED VEHICLE STATS SUCCESS ===")
    res.json(response)
  } catch (error) {
    console.error("=== ENHANCED VEHICLE STATS ERROR ===")
    console.error("DB Error:", error)
    res.status(500).json({ 
      error: "Failed to fetch vehicle statistics",
      details: error.message 
    })
  }
})

// NEW: Enhanced intersection-specific vehicle analytics
router.get("/intersection/:intersectionId", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== INTERSECTION VEHICLE ANALYTICS ===")
    const { intersectionId } = req.params
    const { timeWindow = 60, includeWeather = true } = req.query

    console.log(`🔍 Getting vehicle data for intersection: ${intersectionId}`)
    console.log(`⏰ Time window: ${timeWindow} minutes`)

    // Get recent vehicle data for this intersection
    const timeThreshold = new Date(Date.now() - timeWindow * 60 * 1000)
    console.log(`⌚ Time threshold: ${timeThreshold.toISOString()}`)

    // Try multiple collection strategies
    const vehicleCollection = await db.getCollection(config.VEHICLE_COLLECTION)
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)

    // Strategy 1: Check vehicle_records collection for intersection_id
    console.log(`🔍 Strategy 1: Checking ${config.VEHICLE_COLLECTION} collection for intersection_id`)
    
    let pipeline = [
      {
        $match: {
          intersection_id: intersectionId,
          timestamp: { $gte: timeThreshold }
        }
      },
      {
        $group: {
          _id: "$sensor_direction",
          vehicleCount: { $sum: 1 },
          avgSpeed: { $avg: "$speed_kmh" },
          avgLength: { $avg: "$length_dm" },
          vehicleClasses: { $push: "$vehicle_class" },
          recentTimestamp: { $max: "$timestamp" },
          weatherData: { $first: "$coordinated_weather" },
          sensorIds: { $addToSet: "$sensor_id" }
        }
      },
      { $sort: { vehicleCount: -1 } }
    ]

    let directionStats = await vehicleCollection.aggregate(pipeline).toArray()
    console.log(`📊 Strategy 1 found ${directionStats.length} direction groups`)

    // Strategy 2: If no data found, try traffic_metrics collection
    if (directionStats.length === 0) {
      console.log(`🔍 Strategy 2: Checking ${config.COLLECTION_NAME} collection for intersection_id`)
      
      directionStats = await trafficCollection.aggregate(pipeline).toArray()
      console.log(`📊 Strategy 2 found ${directionStats.length} direction groups`)
    }

    // Strategy 3: If still no data, try removing time filter (historical data)
    if (directionStats.length === 0) {
      console.log(`🔍 Strategy 3: Checking without time filter (historical data)`)
      
      const historicalPipeline = [
        {
          $match: {
            intersection_id: intersectionId
            // Remove timestamp filter to get historical data
          }
        },
        {
          $sort: { timestamp: -1 }
        },
        {
          $limit: 100 // Limit to recent 100 records
        },
        {
          $group: {
            _id: "$sensor_direction",
            vehicleCount: { $sum: 1 },
            avgSpeed: { $avg: "$speed_kmh" },
            avgLength: { $avg: "$length_dm" },
            vehicleClasses: { $push: "$vehicle_class" },
            recentTimestamp: { $max: "$timestamp" },
            weatherData: { $first: "$coordinated_weather" },
            sensorIds: { $addToSet: "$sensor_id" }
          }
        },
        { $sort: { vehicleCount: -1 } }
      ]

      // Try vehicle collection first
      directionStats = await vehicleCollection.aggregate(historicalPipeline).toArray()
      
      // If still empty, try traffic collection
      if (directionStats.length === 0) {
        directionStats = await trafficCollection.aggregate(historicalPipeline).toArray()
      }
      
      console.log(`📊 Strategy 3 found ${directionStats.length} direction groups (historical)`)
    }

    // Strategy 4: If still no data, check if intersection exists at all
    if (directionStats.length === 0) {
      console.log(`🔍 Strategy 4: Checking if intersection exists in any collection`)
      
      // Check all available intersections
      const availableIntersections = await Promise.all([
        vehicleCollection.distinct("intersection_id"),
        trafficCollection.distinct("intersection_id")
      ])
      
      const allIntersections = [...new Set([...availableIntersections[0], ...availableIntersections[1]])]
      console.log(`📍 Available intersections: ${allIntersections.join(', ')}`)
      
      // Try fuzzy matching
      const fuzzyMatches = allIntersections.filter(id => 
        id && (
          id.toLowerCase().includes(intersectionId.toLowerCase()) ||
          intersectionId.toLowerCase().includes(id.toLowerCase())
        )
      )
      
      console.log(`🔍 Fuzzy matches: ${fuzzyMatches.join(', ')}`)

      // Check vehicle collection document count
      const vehicleCollectionCount = await vehicleCollection.countDocuments({})
      const trafficCollectionCount = await trafficCollection.countDocuments({})
      
      console.log(`📊 Collection stats: vehicle_records=${vehicleCollectionCount}, traffic_metrics=${trafficCollectionCount}`)

      // Return helpful error response
      return res.status(404).json({
        intersection_id: intersectionId,
        time_window_minutes: timeWindow,
        analysis_timestamp: new Date().toISOString(),
        total_vehicles: 0,
        avg_intersection_speed: 0,
        direction_breakdown: [],
        enhanced_features: ["legacy_mode"],
        debug_info: {
          strategies_tried: [
            "vehicle_records with intersection_id + time filter",
            "traffic_metrics with intersection_id + time filter",
            "historical data without time filter",
            "intersection existence check"
          ],
          collection_stats: {
            vehicle_records_count: vehicleCollectionCount,
            traffic_metrics_count: trafficCollectionCount
          },
          available_intersections: allIntersections.slice(0, 10), // Limit to first 10
          fuzzy_matches: fuzzyMatches,
          suggestions: [
            fuzzyMatches.length > 0 ? `Try intersection ID: ${fuzzyMatches[0]}` : null,
            vehicleCollectionCount === 0 ? "Vehicle collection is empty - check if Kafka consumers are running" : null,
            "Check if the intersection ID is correctly formatted",
            "Verify that enhanced Rust simulator is producing intersection_id fields"
          ].filter(Boolean)
        },
        error: "No vehicle data found for this intersection",
        message: "Intersection not found or no vehicle data available"
      })
    }

    // Calculate totals
    const totalVehicles = directionStats.reduce((sum, stat) => sum + stat.vehicleCount, 0)
    const avgIntersectionSpeed = directionStats.reduce((sum, stat) => sum + (stat.avgSpeed * stat.vehicleCount), 0) / totalVehicles || 0

    // Determine data source and enhancement status
    const hasWeatherData = directionStats.some(stat => stat.weatherData)
    const hasDirectionData = directionStats.some(stat => stat._id && stat._id !== null)
    const isEnhanced = hasWeatherData || hasDirectionData

    const response = {
      intersection_id: intersectionId,
      time_window_minutes: timeWindow,
      analysis_timestamp: new Date().toISOString(),
      total_vehicles: totalVehicles,
      avg_intersection_speed: Math.round(avgIntersectionSpeed * 100) / 100,
      direction_breakdown: directionStats.map(stat => ({
        sensor_direction: stat._id || 'unknown',
        vehicle_count: stat.vehicleCount,
        avg_speed: Math.round((stat.avgSpeed || 0) * 100) / 100,
        avg_length: Math.round((stat.avgLength || 0) * 100) / 100,
        vehicle_classes: getVehicleClassBreakdown(stat.vehicleClasses || []),
        sensor_ids: stat.sensorIds || [],
        last_update: stat.recentTimestamp,
        ...(includeWeather === 'true' && stat.weatherData && {
          coordinated_weather: stat.weatherData
        })
      })),
      enhanced_features: isEnhanced ? 
        ["intersection_coordination", "weather_sync", "flow_tracking"] : 
        ["legacy_mode"],
      data_source: {
        collection_used: directionStats.length > 0 ? "determined_dynamically" : "none",
        is_enhanced: isEnhanced,
        has_weather_data: hasWeatherData,
        has_direction_mapping: hasDirectionData,
        data_freshness: timeWindow < 120 ? "recent" : "extended_timeframe"
      }
    }

    console.log(`✅ SUCCESS: Found ${totalVehicles} vehicles across ${directionStats.length} directions`)
    console.log(`📊 Enhanced features: ${isEnhanced ? 'YES' : 'NO'}`)
    console.log("=== INTERSECTION VEHICLE ANALYTICS SUCCESS ===")
    
    res.json(response)
  } catch (error) {
    console.error("=== INTERSECTION VEHICLE ANALYTICS ERROR ===")
    console.error("Error:", error)
    res.status(500).json({ 
      error: "Failed to fetch intersection vehicle analytics",
      details: error.message,
      intersection_id: req.params.intersectionId,
      debug_info: {
        error_type: error.name,
        error_stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack
      }
    })
  }
})

// Helper function for vehicle class breakdown
function getVehicleClassBreakdown(vehicleClasses) {
  const breakdown = {}
  vehicleClasses.forEach(cls => {
    breakdown[cls] = (breakdown[cls] || 0) + 1
  })
  return breakdown
}

// NEW: Enhanced streaming with intersection and weather filtering
router.get("/stream", (req, res) => {
  console.log("=== ENHANCED VEHICLE STREAM REQUEST ===")
  const { intersection_id, sensor_direction, weather_condition } = req.query
  
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "Cache-Control")

  const streamService = StreamService.getInstance()
  
  // Enhanced streaming with filtering capabilities
  if (intersection_id) {
    console.log(`Setting up intersection-specific vehicle stream for: ${intersection_id}`)
    streamService.addIntersectionClient("VEHICLE", intersection_id, res)
    
    // Send initial connection confirmation with filter info
    res.write(`data: ${JSON.stringify({
      type: "connection",
      message: "Connected to enhanced vehicle stream",
      filters: {
        intersection_id,
        sensor_direction: sensor_direction || null,
        weather_condition: weather_condition || null
      },
      timestamp: new Date().toISOString()
    })}\n\n`)
  } else {
    console.log("Setting up global vehicle stream")
  streamService.addClient("VEHICLE", res)
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({
      type: "connection",
      message: "Connected to global vehicle stream",
      enhanced_features: ["intersection_filtering", "weather_correlation", "real_time_analytics"],
      timestamp: new Date().toISOString()
    })}\n\n`)
  }

  // Cleanup on disconnect
  res.on("close", () => {
    console.log("Enhanced vehicle stream client disconnected")
  })
})

// NEW: Vehicle length specifications endpoint
router.get("/specifications", (req, res) => {
  try {
    console.log("=== VEHICLE SPECIFICATIONS REQUEST ===")
    
    const response = {
      enhanced_vehicle_lengths: ENHANCED_VEHICLE_LENGTHS,
      status_byte_decoding: {
        bit_2: "Hardware fault (0x04)",
        bit_3: "Low voltage (0x08)", 
        bit_4: "Wrong way driver (0x10)",
        bit_5: "Queue detected (0x20)"
      },
      vehicle_classes: Object.keys(ENHANCED_VEHICLE_LENGTHS),
      integration_info: {
        source: "Enhanced Rust Traffic Simulator",
        version: "2.0",
        features: [
          "Intersection coordination",
          "Weather synchronization", 
          "Enhanced status decoding",
          "Precise length specifications"
        ]
      }
    }

    console.log("=== VEHICLE SPECIFICATIONS SUCCESS ===")
    res.json(response)
  } catch (error) {
    console.error("=== VEHICLE SPECIFICATIONS ERROR ===")
    res.status(500).json({ 
      error: "Failed to fetch vehicle specifications",
      details: error.message 
    })
  }
})

// NEW: Diagnostic endpoint for intersection vehicle data availability
router.get("/intersection/:intersectionId/diagnostics", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== VEHICLE DIAGNOSTICS FOR INTERSECTION ===")
    const { intersectionId } = req.params
    
    const vehicleCollection = await db.getCollection(config.VEHICLE_COLLECTION)
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    
    // Get basic collection stats
    const vehicleStats = {
      total_documents: await vehicleCollection.countDocuments({}),
      with_intersection_id: await vehicleCollection.countDocuments({ intersection_id: { $exists: true, $ne: null } }),
      specific_intersection: await vehicleCollection.countDocuments({ intersection_id: intersectionId }),
      with_sensor_direction: await vehicleCollection.countDocuments({ sensor_direction: { $exists: true, $ne: null } }),
      with_weather: await vehicleCollection.countDocuments({ coordinated_weather: { $exists: true, $ne: null } })
    }
    
    const trafficStats = {
      total_documents: await trafficCollection.countDocuments({}),
      with_intersection_id: await trafficCollection.countDocuments({ intersection_id: { $exists: true, $ne: null } }),
      specific_intersection: await trafficCollection.countDocuments({ intersection_id: intersectionId }),
      with_sensor_direction: await trafficCollection.countDocuments({ sensor_direction: { $exists: true, $ne: null } }),
      with_weather: await trafficCollection.countDocuments({ coordinated_weather: { $exists: true, $ne: null } })
    }
    
    // Get available intersection IDs
    const vehicleIntersections = await vehicleCollection.distinct("intersection_id")
    const trafficIntersections = await trafficCollection.distinct("intersection_id")
    const allIntersections = [...new Set([...vehicleIntersections, ...trafficIntersections])].filter(Boolean)
    
    // Get sample documents for this intersection
    const vehicleSample = await vehicleCollection.findOne({ intersection_id: intersectionId })
    const trafficSample = await trafficCollection.findOne({ intersection_id: intersectionId })
    
    // Get recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentVehicleActivity = await vehicleCollection.countDocuments({ 
      intersection_id: intersectionId, 
      timestamp: { $gte: last24Hours } 
    })
    const recentTrafficActivity = await trafficCollection.countDocuments({ 
      intersection_id: intersectionId, 
      timestamp: { $gte: last24Hours } 
    })
    
    // Try fuzzy matching for intersection name
    const fuzzyMatches = allIntersections.filter(id => 
      id && (
        id.toLowerCase().includes(intersectionId.toLowerCase()) ||
        intersectionId.toLowerCase().includes(id.toLowerCase()) ||
        // Check for partial matches with common intersection naming patterns
        id.toLowerCase().replace(/[-_]/g, '').includes(intersectionId.toLowerCase().replace(/[-_]/g, '')) ||
        intersectionId.toLowerCase().replace(/[-_]/g, '').includes(id.toLowerCase().replace(/[-_]/g, ''))
      )
    )
    
    const response = {
      intersection_id: intersectionId,
      diagnostic_timestamp: new Date().toISOString(),
      collection_analysis: {
        vehicle_records: vehicleStats,
        traffic_metrics: trafficStats
      },
      intersection_availability: {
        exists_in_vehicle_collection: vehicleStats.specific_intersection > 0,
        exists_in_traffic_collection: trafficStats.specific_intersection > 0,
        total_available_intersections: allIntersections.length,
        vehicle_intersections: vehicleIntersections.length,
        traffic_intersections: trafficIntersections.length
      },
      recent_activity: {
        vehicle_records_last_24h: recentVehicleActivity,
        traffic_metrics_last_24h: recentTrafficActivity,
        has_recent_data: (recentVehicleActivity + recentTrafficActivity) > 0
      },
      sample_documents: {
        vehicle_sample: vehicleSample ? {
          sensor_id: vehicleSample.sensor_id,
          intersection_id: vehicleSample.intersection_id,
          sensor_direction: vehicleSample.sensor_direction,
          has_weather: !!vehicleSample.coordinated_weather,
          timestamp: vehicleSample.timestamp,
          vehicle_class: vehicleSample.vehicle_class
        } : null,
        traffic_sample: trafficSample ? {
          sensor_id: trafficSample.sensor_id,
          intersection_id: trafficSample.intersection_id,
          sensor_direction: trafficSample.sensor_direction,
          has_weather: !!trafficSample.coordinated_weather,
          timestamp: trafficSample.timestamp,
          density: trafficSample.density,
          speed: trafficSample.speed
        } : null
      },
      suggestions: {
        fuzzy_matches: fuzzyMatches,
        possible_alternatives: fuzzyMatches.slice(0, 5),
        recommendations: [
          vehicleStats.total_documents === 0 && trafficStats.total_documents === 0 ? 
            "No data in either collection - check if Kafka consumers are running" : null,
          vehicleStats.with_intersection_id === 0 && trafficStats.with_intersection_id === 0 ? 
            "No intersection_id fields found - check if enhanced Rust simulator is running" : null,
          fuzzyMatches.length > 0 ? 
            `Try these similar intersection IDs: ${fuzzyMatches.slice(0, 3).join(', ')}` : null,
          vehicleStats.specific_intersection === 0 && trafficStats.specific_intersection === 0 ? 
            "This exact intersection ID not found in database" : null,
          recentVehicleActivity === 0 && recentTrafficActivity === 0 ? 
            "No recent activity - data may be stale or simulator not running" : null
        ].filter(Boolean)
      },
      all_available_intersections: allIntersections.slice(0, 20) // Limit to first 20 for response size
    }
    
    console.log("=== VEHICLE DIAGNOSTICS SUCCESS ===")
    res.json(response)
    
  } catch (error) {
    console.error("=== VEHICLE DIAGNOSTICS ERROR ===")
    console.error("Error:", error)
    res.status(500).json({ 
      error: "Failed to run vehicle diagnostics",
      details: error.message,
      intersection_id: req.params.intersectionId
    })
  }
})

module.exports = router

