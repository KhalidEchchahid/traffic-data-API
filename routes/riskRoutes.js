/**
 * Risk Analysis Routes for Traffic Data API
 * Big Daddy's Comprehensive Risk Assessment Endpoints
 * 
 * Provides real-time risk analysis, geographical risk mapping,
 * and historical risk pattern analysis
 */

const express = require("express")
const router = express.Router()
const Database = require("../db/database")
const config = require("../config/config")
const { calculateRiskScore, calculateRiskScoreV1, identifyRiskFactors, analyzeRiskPatterns } = require("../utils/riskAnalysis")

/**
 * ENDPOINT 1: Comprehensive Risk Analysis
 * GET /api/risk/analysis
 * 
 * Provides real-time risk assessment based on current traffic conditions,
 * intersection data, environmental factors, and recent incident history
 */
router.get("/analysis", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== RISK ANALYSIS ENDPOINT ===")
    
    const { 
      intersection_id, 
      sensor_id, 
      location_id,
      include_historical = 'true',
      time_window = 60 // minutes for recent data
    } = req.query

    console.log("Query parameters:", { intersection_id, sensor_id, location_id, include_historical, time_window })

    // === STEP 1: Get Current Traffic Data ===
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    
    let trafficFilter = {}
    if (intersection_id) trafficFilter.intersection_id = intersection_id
    if (sensor_id) trafficFilter.sensor_id = sensor_id
    if (location_id) trafficFilter.location_id = location_id

    // Get most recent traffic data
    const currentTrafficData = await trafficCollection
      .find(trafficFilter)
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()

    console.log("Current traffic data found:", currentTrafficData.length)

    if (currentTrafficData.length === 0) {
      return res.status(404).json({
        error: "No traffic data available for risk analysis",
        filters: trafficFilter,
        suggestion: "Check if sensor_id, intersection_id, or location_id exist in the database"
      })
    }

    const trafficData = currentTrafficData[0]
    console.log("Traffic data timestamp:", trafficData.timestamp)

    // === STEP 2: Get Current Intersection Data ===
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    
    let intersectionFilter = {}
    if (intersection_id || trafficData.intersection_id) {
      intersectionFilter.intersection_id = intersection_id || trafficData.intersection_id
    }
    if (sensor_id || trafficData.sensor_id) {
      intersectionFilter.sensor_id = sensor_id || trafficData.sensor_id
    }

    const currentIntersectionData = await intersectionCollection
      .find(intersectionFilter)
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()

    console.log("Current intersection data found:", currentIntersectionData.length)

    const intersectionData = currentIntersectionData.length > 0 ? currentIntersectionData[0] : null

    // === STEP 3: Get Recent Alerts ===
    const alertsCollection = await db.getCollection(config.ALERTS_COLLECTION)
    
    const timeWindowMs = parseInt(time_window) * 60 * 1000 // Convert minutes to milliseconds
    const recentTimeThreshold = new Date(Date.now() - timeWindowMs)

    let alertsFilter = {
      timestamp: { $gte: recentTimeThreshold }
    }

    // Filter alerts by location if available
    if (intersection_id || trafficData.intersection_id) {
      alertsFilter.$or = [
        { intersection_id: intersection_id || trafficData.intersection_id },
        { sensor_id: sensor_id || trafficData.sensor_id }
      ]
    } else if (sensor_id || trafficData.sensor_id) {
      alertsFilter.sensor_id = sensor_id || trafficData.sensor_id
    }

    const recentAlerts = await alertsCollection
      .find(alertsFilter)
      .sort({ timestamp: -1 })
      .toArray()

    console.log("Recent alerts found:", recentAlerts.length)

    // === STEP 4: Calculate Comprehensive Risk Score ===
    const riskAnalysis = calculateRiskScore(
      trafficData,
      intersectionData,
      null, // Environmental data is included in traffic/intersection data
      recentAlerts
    )

    console.log("Risk analysis completed. Score:", riskAnalysis.riskScore)

    // === STEP 5: Historical Pattern Analysis (if requested) ===
    let historicalAnalysis = null
    
    if (include_historical === 'true') {
      console.log("Including historical risk analysis...")
      
      // Get historical data for pattern analysis (last 30 days)
      const historicalThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      
      const historicalData = await trafficCollection
        .find({
          ...trafficFilter,
          timestamp: { $gte: historicalThreshold }
        })
        .sort({ timestamp: 1 })
        .toArray()

      console.log("Historical data points:", historicalData.length)

      // Calculate risk scores for historical data
      const historicalRiskData = historicalData.map(data => ({
        timestamp: data.timestamp,
        riskScore: calculateRiskScoreV1(data)
      }))

      historicalAnalysis = analyzeRiskPatterns(historicalRiskData)
      console.log("Historical patterns found:", historicalAnalysis.patterns.length)
    }

    // === STEP 6: Generate Recommendations ===
    const recommendations = []

    // Critical risk recommendations
    if (riskAnalysis.riskScore >= 80) {
      recommendations.push({
        priority: 'critical',
        action: 'immediate_attention',
        description: 'Critical risk level detected. Consider traffic management intervention.'
      })
    }

    // High risk recommendations
    if (riskAnalysis.riskScore >= 60) {
      recommendations.push({
        priority: 'high',
        action: 'increased_monitoring',
        description: 'High risk level. Increase monitoring frequency and consider alerts.'
      })
    }

    // Specific factor-based recommendations
    riskAnalysis.riskFactors.forEach(factor => {
      if (factor.severity === 'critical') {
        recommendations.push({
          priority: 'critical',
          action: 'address_factor',
          description: `Address critical factor: ${factor.description}`,
          factor: factor.factor
        })
      }
    })

    // Weather-related recommendations
    const hasWeatherRisk = riskAnalysis.riskFactors.some(f => f.category === 'environment')
    if (hasWeatherRisk) {
      recommendations.push({
        priority: 'medium',
        action: 'weather_advisory',
        description: 'Weather conditions affecting safety. Consider issuing advisory.'
      })
    }

    // === STEP 7: Build Response ===
    const response = {
      risk_analysis: {
        overall_risk: {
          score: riskAnalysis.riskScore,
          level: riskAnalysis.riskLevel,
          timestamp: riskAnalysis.timestamp
        },
        risk_breakdown: riskAnalysis.breakdown,
        risk_factors: riskAnalysis.riskFactors,
        total_factors: riskAnalysis.riskFactors.length
      },
      current_conditions: {
        traffic_data: {
          sensor_id: trafficData.sensor_id,
          intersection_id: trafficData.intersection_id,
          location_id: trafficData.location_id,
          speed: trafficData.speed,
          density: trafficData.density,
          congestion_level: trafficData.congestion_level,
          incident_detected: trafficData.incident_detected,
          weather_conditions: trafficData.weather_conditions,
          timestamp: trafficData.timestamp
        },
        intersection_data: intersectionData ? {
          intersection_id: intersectionData.intersection_id,
          stopped_vehicles: intersectionData.stopped_vehicles_count,
          average_wait_time: intersectionData.average_wait_time,
          risky_behavior: intersectionData.risky_behavior_detected,
          collision_count: intersectionData.collision_count,
          timestamp: intersectionData.timestamp
        } : null,
        recent_alerts: {
          count: recentAlerts.length,
          time_window_minutes: parseInt(time_window),
          high_severity_count: recentAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length
        }
      },
      recommendations,
      historical_analysis: historicalAnalysis,
      metadata: {
        analysis_timestamp: new Date().toISOString(),
        data_sources: {
          traffic_collection: config.COLLECTION_NAME,
          intersection_collection: config.INTERSECTION_COLLECTION,
          alerts_collection: config.ALERTS_COLLECTION
        },
        filters_applied: {
          intersection_id: intersection_id || trafficData.intersection_id,
          sensor_id: sensor_id || trafficData.sensor_id,
          location_id: location_id || trafficData.location_id
        }
      }
    }

    console.log("=== RISK ANALYSIS SUCCESS ===")
    res.json(response)

  } catch (error) {
    console.error("=== RISK ANALYSIS ERROR ===")
    console.error("Error details:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      error: "Failed to perform risk analysis",
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * ENDPOINT 2: Risk Heatmap Data
 * GET /api/risk/heatmap
 * 
 * Provides geographical risk mapping data for visualization
 * Shows risk levels across different intersections and locations
 */
router.get("/heatmap", async (req, res) => {
  const db = Database.getInstance()
  try {
    console.log("=== RISK HEATMAP ENDPOINT ===")
    
    const { 
      time_window = 1440, // 24 hours in minutes (was 120)
      min_risk_score = 0,
      max_risk_score = 100,
      include_factors = 'false'
    } = req.query

    console.log("Query parameters:", { time_window, min_risk_score, max_risk_score, include_factors })

    // === STEP 1: Get Recent Traffic Data by Location ===
    const trafficCollection = await db.getCollection(config.COLLECTION_NAME)
    const intersectionCollection = await db.getCollection(config.INTERSECTION_COLLECTION)
    const alertsCollection = await db.getCollection(config.ALERTS_COLLECTION)

    const timeWindowMs = parseInt(time_window) * 60 * 1000
    const recentTimeThreshold = new Date(Date.now() - timeWindowMs)

    console.log("Time threshold:", recentTimeThreshold.toISOString())
    console.log("Time window (hours):", timeWindowMs / (1000 * 60 * 60))

    // First, let's check if we have any data at all in these collections
    const trafficTotalCount = await trafficCollection.countDocuments({})
    const intersectionTotalCount = await intersectionCollection.countDocuments({})
    const alertsTotalCount = await alertsCollection.countDocuments({})
    
    console.log("=== DATA AVAILABILITY CHECK ===")
    console.log("Total traffic documents:", trafficTotalCount)
    console.log("Total intersection documents:", intersectionTotalCount)
    console.log("Total alerts documents:", alertsTotalCount)

    // Check if we have any recent data (within time window)
    // Convert threshold to ISO string for comparison with string timestamps
    let recentTimeThresholdString = recentTimeThreshold.toISOString()
    
    const recentTrafficCount = await trafficCollection.countDocuments({
      timestamp: { $gte: recentTimeThresholdString }
    })
    const recentIntersectionCount = await intersectionCollection.countDocuments({
      timestamp: { $gte: recentTimeThresholdString }
    })
    const recentAlertsCount = await alertsCollection.countDocuments({
      timestamp: { $gte: recentTimeThresholdString }
    })

    console.log("=== RECENT DATA (within time window) ===")
    console.log("Time threshold as string:", recentTimeThresholdString)
    console.log("Recent traffic documents:", recentTrafficCount)
    console.log("Recent intersection documents:", recentIntersectionCount)
    console.log("Recent alerts documents:", recentAlertsCount)

    // If no recent data, let's get the most recent timestamp from each collection
    if (recentTrafficCount === 0 && recentIntersectionCount === 0) {
      console.log("=== NO RECENT DATA FOUND - CHECKING LATEST TIMESTAMPS ===")
      
      if (trafficTotalCount > 0) {
        const latestTraffic = await trafficCollection.findOne({}, { sort: { timestamp: -1 } })
        console.log("Latest traffic timestamp:", latestTraffic?.timestamp)
        console.log("Traffic data age (hours):", latestTraffic ? (Date.now() - new Date(latestTraffic.timestamp).getTime()) / (1000 * 60 * 60) : "N/A")
      }
      
      if (intersectionTotalCount > 0) {
        const latestIntersection = await intersectionCollection.findOne({}, { sort: { timestamp: -1 } })
        console.log("Latest intersection timestamp:", latestIntersection?.timestamp)
        console.log("Intersection data age (hours):", latestIntersection ? (Date.now() - new Date(latestIntersection.timestamp).getTime()) / (1000 * 60 * 60) : "N/A")
      }

      // If no recent data, let's use a much larger time window
      const extendedTimeWindow = 7 * 24 * 60 * 60 * 1000 // 7 days
      const extendedThreshold = new Date(Date.now() - extendedTimeWindow)
      const extendedThresholdString = extendedThreshold.toISOString()
      
      console.log("Trying extended time window (7 days):", extendedThresholdString)
      
      const extendedTrafficCount = await trafficCollection.countDocuments({
        timestamp: { $gte: extendedThresholdString }
      })
      const extendedIntersectionCount = await intersectionCollection.countDocuments({
        timestamp: { $gte: extendedThresholdString }
      })
      
      console.log("Extended traffic documents (7 days):", extendedTrafficCount)
      console.log("Extended intersection documents (7 days):", extendedIntersectionCount)

      // If we found data in extended window, use that threshold instead
      if (extendedTrafficCount > 0 || extendedIntersectionCount > 0) {
        console.log("Using extended time window for analysis")
        // Override the time threshold to use extended window
        recentTimeThreshold.setTime(extendedThreshold.getTime())
        // Update the string version too
        recentTimeThresholdString = extendedThresholdString
      }
    } else {
      console.log("=== RECENT DATA FOUND ===")
      console.log("Proceeding with normal analysis using original time threshold")
    }

    // Additional debugging: check for timestamp type issues
    if (trafficTotalCount > 0) {
      const sampleTraffic = await trafficCollection.findOne({})
      console.log("Sample traffic timestamp type:", typeof sampleTraffic?.timestamp)
      console.log("Sample traffic timestamp value:", sampleTraffic?.timestamp)
    }
    
    if (intersectionTotalCount > 0) {
      const sampleIntersection = await intersectionCollection.findOne({})
      console.log("Sample intersection timestamp type:", typeof sampleIntersection?.timestamp)
      console.log("Sample intersection timestamp value:", sampleIntersection?.timestamp)
    }

    // Get recent traffic data grouped by location
    const trafficPipeline = [
      {
        $match: {
          timestamp: { $gte: recentTimeThresholdString }
        }
      },
      {
        $group: {
          _id: {
            intersection_id: "$intersection_id",
            sensor_id: "$sensor_id",
            location_id: "$location_id"
          },
          latest_data: { $last: "$$ROOT" },
          avg_speed: { $avg: "$speed" },
          avg_density: { $avg: "$density" },
          incident_count: { 
            $sum: { $cond: [{ $eq: ["$incident_detected", true] }, 1, 0] }
          },
          data_points: { $sum: 1 }
        }
      },
      {
        $match: {
          data_points: { $gte: 1 } // Ensure we have data
        }
      }
    ]

    const trafficByLocation = await trafficCollection.aggregate(trafficPipeline).toArray()
    console.log("Traffic locations found:", trafficByLocation.length)

    // === STEP 2: Get Recent Intersection Data ===
    const intersectionPipeline = [
      {
        $match: {
          timestamp: { $gte: recentTimeThresholdString }
        }
      },
      {
        $group: {
          _id: {
            intersection_id: "$intersection_id",
            sensor_id: "$sensor_id"
          },
          latest_data: { $last: "$$ROOT" },
          avg_wait_time: { $avg: "$average_wait_time" },
          total_collisions: { $sum: "$collision_count" },
          risky_behavior_incidents: { 
            $sum: { $cond: [{ $eq: ["$risky_behavior_detected", true] }, 1, 0] }
          },
          data_points: { $sum: 1 }
        }
      }
    ]

    const intersectionByLocation = await intersectionCollection.aggregate(intersectionPipeline).toArray()
    console.log("Intersection locations found:", intersectionByLocation.length)

    // === STEP 3: Get Recent Alerts by Location ===
    const alertsPipeline = [
      {
        $match: {
          timestamp: { $gte: recentTimeThresholdString }
        }
      },
      {
        $group: {
          _id: {
            intersection_id: "$intersection_id",
            sensor_id: "$sensor_id"
          },
          alert_count: { $sum: 1 },
          high_severity_count: {
            $sum: {
              $cond: [
                { $in: ["$severity", ["high", "critical"]] },
                1,
                0
              ]
            }
          },
          latest_alert: { $last: "$$ROOT" }
        }
      }
    ]

    const alertsByLocation = await alertsCollection.aggregate(alertsPipeline).toArray()
    console.log("Alert locations found:", alertsByLocation.length)

    // If still no data found, provide helpful debug response
    if (trafficByLocation.length === 0 && intersectionByLocation.length === 0) {
      console.log("=== NO DATA FOUND FOR HEATMAP ===")
      
      // Get sample intersection_ids and sensor_ids from each collection
      const sampleTrafficIds = await trafficCollection.distinct("intersection_id", {}, { limit: 5 })
      const sampleIntersectionIds = await intersectionCollection.distinct("intersection_id", {}, { limit: 5 })
      const sampleSensorIds = await trafficCollection.distinct("sensor_id", {}, { limit: 5 })

      return res.json({
        heatmap_data: [],
        summary: {
          total_locations: 0,
          risk_distribution: { critical: 0, high: 0, medium: 0, low: 0 },
          average_risk_score: 0,
          highest_risk_location: null
        },
        debug_info: {
          time_window_hours: timeWindowMs / (1000 * 60 * 60),
          time_threshold: recentTimeThreshold.toISOString(),
          data_availability: {
            total_traffic_documents: trafficTotalCount,
            total_intersection_documents: intersectionTotalCount,
            total_alerts_documents: alertsTotalCount,
            recent_traffic_documents: recentTrafficCount,
            recent_intersection_documents: recentIntersectionCount,
            recent_alerts_documents: recentAlertsCount
          },
          sample_ids: {
            traffic_intersection_ids: sampleTrafficIds,
            intersection_intersection_ids: sampleIntersectionIds,
            sensor_ids: sampleSensorIds
          },
          suggestions: [
            "Data might be older than the time window",
            "Check if Kafka consumers are running and producing data",
            "Try a longer time window parameter",
            "Verify timestamp formats in the database"
          ]
        },
        parameters: {
          time_window_minutes: parseInt(time_window),
          risk_score_range: {
            min: parseFloat(min_risk_score),
            max: parseFloat(max_risk_score)
          },
          include_risk_factors: include_factors === 'true'
        },
        metadata: {
          generated_at: new Date().toISOString(),
          data_sources: {
            traffic_locations: trafficByLocation.length,
            intersection_locations: intersectionByLocation.length,
            alert_locations: alertsByLocation.length
          }
        }
      })
    }

    // === STEP 4: Combine Data and Calculate Risk Scores ===
    const locationRiskMap = {}

    // Process traffic data
    trafficByLocation.forEach(location => {
      const key = `${location._id.intersection_id || 'unknown'}_${location._id.sensor_id || 'unknown'}`
      
      if (!locationRiskMap[key]) {
        locationRiskMap[key] = {
          intersection_id: location._id.intersection_id,
          sensor_id: location._id.sensor_id,
          location_id: location._id.location_id,
          coordinates: {
            lat: location.latest_data.location_y || null,
            lng: location.latest_data.location_x || null
          },
          traffic_data: location.latest_data,
          intersection_data: null,
          alerts_data: [],
          alerts_stats: {
            alert_count: 0,
            high_severity_count: 0,
            latest_alert: null
          },
          risk_factors: []
        }
      }
      
      locationRiskMap[key].traffic_data = location.latest_data
      locationRiskMap[key].traffic_stats = {
        avg_speed: location.avg_speed,
        avg_density: location.avg_density,
        incident_count: location.incident_count,
        data_points: location.data_points
      }
    })

    // Process intersection data
    intersectionByLocation.forEach(location => {
      const key = `${location._id.intersection_id || 'unknown'}_${location._id.sensor_id || 'unknown'}`
      
      if (!locationRiskMap[key]) {
        locationRiskMap[key] = {
          intersection_id: location._id.intersection_id,
          sensor_id: location._id.sensor_id,
          coordinates: { lat: null, lng: null },
          traffic_data: null,
          intersection_data: location.latest_data,
          alerts_data: [],
          alerts_stats: {
            alert_count: 0,
            high_severity_count: 0,
            latest_alert: null
          },
          risk_factors: []
        }
      } else {
        locationRiskMap[key].intersection_data = location.latest_data
      }
      
      locationRiskMap[key].intersection_stats = {
        avg_wait_time: location.avg_wait_time,
        total_collisions: location.total_collisions,
        risky_behavior_incidents: location.risky_behavior_incidents,
        data_points: location.data_points
      }
    })

    // Process alerts data
    console.log("Processing alerts data...")
    alertsByLocation.forEach(location => {
      const key = `${location._id.intersection_id || 'unknown'}_${location._id.sensor_id || 'unknown'}`
      console.log("Processing alert location with key:", key)
      console.log("Alert location data:", {
        intersection_id: location._id.intersection_id,
        sensor_id: location._id.sensor_id,
        alert_count: location.alert_count
      })
      
      if (locationRiskMap[key]) {
        console.log("Found matching location for alerts, adding alert stats")
        locationRiskMap[key].alerts_stats = {
          alert_count: location.alert_count,
          high_severity_count: location.high_severity_count,
          latest_alert: location.latest_alert
        }
      } else {
        console.log("No matching location found for alert key:", key)
        console.log("Available location keys:", Object.keys(locationRiskMap))
        
        // Try to find a partial match by intersection_id or sensor_id
        let foundMatch = false
        for (const locationKey of Object.keys(locationRiskMap)) {
          const locationData = locationRiskMap[locationKey]
          
          // Try matching by intersection_id
          if (location._id.intersection_id && 
              locationData.intersection_id === location._id.intersection_id) {
            console.log("Found partial match by intersection_id:", locationKey)
            locationData.alerts_stats = {
              alert_count: location.alert_count,
              high_severity_count: location.high_severity_count,
              latest_alert: location.latest_alert
            }
            foundMatch = true
            break
          }
          
          // Try matching by sensor_id  
          if (location._id.sensor_id && 
              locationData.sensor_id === location._id.sensor_id) {
            console.log("Found partial match by sensor_id:", locationKey)
            locationData.alerts_stats = {
              alert_count: location.alert_count,
              high_severity_count: location.high_severity_count,
              latest_alert: location.latest_alert
            }
            foundMatch = true
            break
          }
        }
        
        if (!foundMatch) {
          console.log("No match found even with partial matching")
        }
      }
    })

    // === STEP 5: Calculate Risk Scores for Each Location ===
    const heatmapData = []

    Object.values(locationRiskMap).forEach(location => {
      if (!location.traffic_data && !location.intersection_data) {
        return // Skip locations without sufficient data
      }

      // Get alerts for this location
      const locationAlerts = alertsByLocation
        .filter(alert => 
          alert._id.intersection_id === location.intersection_id ||
          alert._id.sensor_id === location.sensor_id
        )
        .map(alert => alert.latest_alert)

      // Calculate risk score
      const riskAnalysis = calculateRiskScore(
        location.traffic_data || {},
        location.intersection_data,
        null,
        locationAlerts
      )

      // Filter by risk score range
      if (riskAnalysis.riskScore < parseFloat(min_risk_score) || 
          riskAnalysis.riskScore > parseFloat(max_risk_score)) {
        return
      }

      const heatmapPoint = {
        location: {
          intersection_id: location.intersection_id,
          sensor_id: location.sensor_id,
          location_id: location.location_id,
          coordinates: location.coordinates
        },
        risk_score: riskAnalysis.riskScore,
        risk_level: riskAnalysis.riskLevel,
        risk_breakdown: riskAnalysis.breakdown,
        stats: {
          traffic: location.traffic_stats || null,
          intersection: location.intersection_stats || null,
          alerts: location.alerts_stats || null
        },
        last_updated: location.traffic_data?.timestamp || location.intersection_data?.timestamp
      }

      // Include risk factors if requested
      if (include_factors === 'true') {
        heatmapPoint.risk_factors = riskAnalysis.riskFactors
      }

      heatmapData.push(heatmapPoint)
    })

    // === STEP 6: Sort by Risk Score ===
    heatmapData.sort((a, b) => b.risk_score - a.risk_score)

    // === STEP 7: Generate Summary Statistics ===
    const summary = {
      total_locations: heatmapData.length,
      risk_distribution: {
        critical: heatmapData.filter(d => d.risk_level === 'critical').length,
        high: heatmapData.filter(d => d.risk_level === 'high').length,
        medium: heatmapData.filter(d => d.risk_level === 'medium').length,
        low: heatmapData.filter(d => d.risk_level === 'low').length
      },
      average_risk_score: heatmapData.length > 0 
        ? heatmapData.reduce((sum, d) => sum + d.risk_score, 0) / heatmapData.length 
        : 0,
      highest_risk_location: heatmapData.length > 0 ? heatmapData[0] : null
    }

    console.log("=== RISK HEATMAP SUCCESS ===")
    console.log("Heatmap points generated:", heatmapData.length)

    res.json({
      heatmap_data: heatmapData,
      summary,
      parameters: {
        time_window_minutes: parseInt(time_window),
        risk_score_range: {
          min: parseFloat(min_risk_score),
          max: parseFloat(max_risk_score)
        },
        include_risk_factors: include_factors === 'true'
      },
      metadata: {
        generated_at: new Date().toISOString(),
        data_sources: {
          traffic_locations: trafficByLocation.length,
          intersection_locations: intersectionByLocation.length,
          alert_locations: alertsByLocation.length
        }
      }
    })

  } catch (error) {
    console.error("=== RISK HEATMAP ERROR ===")
    console.error("Error details:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      error: "Failed to generate risk heatmap",
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router
