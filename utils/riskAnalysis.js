/**
 * Comprehensive Risk Analysis Utilities for Traffic Data
 * Big Daddy's Traffic Risk Assessment System
 * 
 * Analyzes traffic, intersection, vehicle, and environmental data
 * to calculate real-time risk scores and identify patterns
 */

/**
 * Calculate comprehensive risk score based on multiple data sources
 * @param {Object} trafficData - Traffic metrics data
 * @param {Object} intersectionData - Intersection-specific data
 * @param {Object} environmentData - Weather and environmental factors
 * @param {Array} alertsData - Recent alerts data
 * @returns {Object} Risk analysis result with score and factors
 */
function calculateRiskScore(trafficData, intersectionData = null, environmentData = null, alertsData = []) {
  let riskScore = 0
  const riskFactors = []
  const weights = {
    traffic: 0.35,
    intersection: 0.25,
    environment: 0.20,
    incidents: 0.20
  }

  // === TRAFFIC RISK FACTORS (35% weight) ===
  let trafficRisk = 0

  // Speed-related risk
  if (trafficData.speed !== undefined && trafficData.speed !== null) {
    if (trafficData.speed < 10) {
      trafficRisk += 25
      riskFactors.push({
        category: 'traffic',
        factor: 'very_low_speed',
        severity: 'high',
        value: trafficData.speed,
        description: `Extremely low speed (${trafficData.speed} km/h) indicates severe congestion`
      })
    } else if (trafficData.speed < 20) {
      trafficRisk += 15
      riskFactors.push({
        category: 'traffic',
        factor: 'low_speed',
        severity: 'medium',
        value: trafficData.speed,
        description: `Low speed (${trafficData.speed} km/h) indicates congestion`
      })
    } else if (trafficData.speed > 80) {
      trafficRisk += 20
      riskFactors.push({
        category: 'traffic',
        factor: 'excessive_speed',
        severity: 'high',
        value: trafficData.speed,
        description: `Excessive speed (${trafficData.speed} km/h) increases accident risk`
      })
    }
  }

  // Density and congestion risk
  if (trafficData.density !== undefined && trafficData.density !== null) {
    if (trafficData.density > 80) {
      trafficRisk += 20
      riskFactors.push({
        category: 'traffic',
        factor: 'high_density',
        severity: 'high',
        value: trafficData.density,
        description: `High traffic density (${trafficData.density}) increases collision risk`
      })
    } else if (trafficData.density > 60) {
      trafficRisk += 10
      riskFactors.push({
        category: 'traffic',
        factor: 'medium_density',
        severity: 'medium',
        value: trafficData.density,
        description: `Medium traffic density (${trafficData.density}) requires caution`
      })
    }
  }

  // Congestion level risk
  if (trafficData.congestion_level) {
    switch (trafficData.congestion_level.toLowerCase()) {
      case 'high':
      case 'critical':
        trafficRisk += 15
        riskFactors.push({
          category: 'traffic',
          factor: 'high_congestion',
          severity: 'high',
          value: trafficData.congestion_level,
          description: `High congestion level increases risk of rear-end collisions`
        })
        break
      case 'medium':
        trafficRisk += 8
        riskFactors.push({
          category: 'traffic',
          factor: 'medium_congestion',
          severity: 'medium',
          value: trafficData.congestion_level,
          description: `Medium congestion requires increased following distance`
        })
        break
    }
  }

  // Incident detection risk
  if (trafficData.incident_detected === true) {
    trafficRisk += 30
    riskFactors.push({
      category: 'traffic',
      factor: 'active_incident',
      severity: 'critical',
      value: true,
      description: `Active incident detected - high risk area`
    })
  }

  // Near miss events
  if (trafficData.near_miss_events > 0) {
    trafficRisk += Math.min(trafficData.near_miss_events * 8, 25)
    riskFactors.push({
      category: 'traffic',
      factor: 'near_miss_events',
      severity: trafficData.near_miss_events > 3 ? 'high' : 'medium',
      value: trafficData.near_miss_events,
      description: `${trafficData.near_miss_events} near miss events indicate dangerous conditions`
    })
  }

  // === INTERSECTION RISK FACTORS (25% weight) ===
  let intersectionRisk = 0

  if (intersectionData) {
    // Stopped vehicles risk
    if (intersectionData.stopped_vehicles_count > 40) {
      intersectionRisk += 20
      riskFactors.push({
        category: 'intersection',
        factor: 'high_stopped_vehicles',
        severity: 'high',
        value: intersectionData.stopped_vehicles_count,
        description: `High number of stopped vehicles (${intersectionData.stopped_vehicles_count}) creates congestion risk`
      })
    } else if (intersectionData.stopped_vehicles_count > 25) {
      intersectionRisk += 10
      riskFactors.push({
        category: 'intersection',
        factor: 'medium_stopped_vehicles',
        severity: 'medium',
        value: intersectionData.stopped_vehicles_count,
        description: `Moderate queue length may cause delays`
      })
    }

    // Average wait time risk
    if (intersectionData.average_wait_time > 90) {
      intersectionRisk += 15
      riskFactors.push({
        category: 'intersection',
        factor: 'excessive_wait_time',
        severity: 'high',
        value: intersectionData.average_wait_time,
        description: `Excessive wait time (${intersectionData.average_wait_time}s) indicates poor traffic flow`
      })
    } else if (intersectionData.average_wait_time > 60) {
      intersectionRisk += 8
      riskFactors.push({
        category: 'intersection',
        factor: 'high_wait_time',
        severity: 'medium',
        value: intersectionData.average_wait_time,
        description: `High wait time reduces intersection efficiency`
      })
    }

    // Risky behavior detection
    if (intersectionData.risky_behavior_detected === true) {
      intersectionRisk += 25
      riskFactors.push({
        category: 'intersection',
        factor: 'risky_behavior',
        severity: 'critical',
        value: true,
        description: `Aggressive or risky driving behavior detected`
      })
    }

    // Sudden braking events
    if (intersectionData.sudden_braking_events > 5) {
      intersectionRisk += 15
      riskFactors.push({
        category: 'intersection',
        factor: 'frequent_braking',
        severity: 'high',
        value: intersectionData.sudden_braking_events,
        description: `${intersectionData.sudden_braking_events} sudden braking events indicate dangerous conditions`
      })
    } else if (intersectionData.sudden_braking_events > 2) {
      intersectionRisk += 8
      riskFactors.push({
        category: 'intersection',
        factor: 'some_braking',
        severity: 'medium',
        value: intersectionData.sudden_braking_events,
        description: `Multiple sudden braking events detected`
      })
    }

    // Collision count
    if (intersectionData.collision_count > 0) {
      intersectionRisk += 40
      riskFactors.push({
        category: 'intersection',
        factor: 'active_collisions',
        severity: 'critical',
        value: intersectionData.collision_count,
        description: `${intersectionData.collision_count} collision(s) occurred - critical safety issue`
      })
    }

    // Wrong way vehicles
    if (intersectionData.wrong_way_vehicles > 0) {
      intersectionRisk += 30
      riskFactors.push({
        category: 'intersection',
        factor: 'wrong_way_vehicles',
        severity: 'critical',
        value: intersectionData.wrong_way_vehicles,
        description: `Wrong-way vehicles detected - extremely dangerous`
      })
    }

    // Traffic light compliance
    if (intersectionData.traffic_light_compliance_rate < 80) {
      intersectionRisk += 20
      riskFactors.push({
        category: 'intersection',
        factor: 'poor_compliance',
        severity: 'high',
        value: intersectionData.traffic_light_compliance_rate,
        description: `Low traffic light compliance (${intersectionData.traffic_light_compliance_rate}%) increases accident risk`
      })
    } else if (intersectionData.traffic_light_compliance_rate < 90) {
      intersectionRisk += 10
      riskFactors.push({
        category: 'intersection',
        factor: 'medium_compliance',
        severity: 'medium',
        value: intersectionData.traffic_light_compliance_rate,
        description: `Moderate compliance rate requires monitoring`
      })
    }
  }

  // === ENVIRONMENTAL RISK FACTORS (20% weight) ===
  let environmentRisk = 0

  // Weather conditions
  const weatherConditions = environmentData?.weather_conditions || 
                          environmentData?.local_weather_conditions || 
                          intersectionData?.local_weather_conditions ||
                          trafficData?.weather_conditions

  if (weatherConditions) {
    switch (weatherConditions.toLowerCase()) {
      case 'rain':
      case 'heavy_rain':
        environmentRisk += 20
        riskFactors.push({
          category: 'environment',
          factor: 'rain',
          severity: 'high',
          value: weatherConditions,
          description: `Rainy conditions increase stopping distance and accident risk`
        })
        break
      case 'snow':
      case 'ice':
      case 'sleet':
        environmentRisk += 30
        riskFactors.push({
          category: 'environment',
          factor: 'winter_weather',
          severity: 'critical',
          value: weatherConditions,
          description: `Winter weather conditions create hazardous driving conditions`
        })
        break
      case 'fog':
        environmentRisk += 25
        riskFactors.push({
          category: 'environment',
          factor: 'fog',
          severity: 'high',
          value: weatherConditions,
          description: `Foggy conditions severely reduce visibility`
        })
        break
    }
  }

  // Visibility issues
  const fogDetected = environmentData?.fog_or_smoke_detected || 
                     intersectionData?.fog_or_smoke_detected ||
                     trafficData?.visibility === 'poor'

  if (fogDetected === true) {
    environmentRisk += 20
    riskFactors.push({
      category: 'environment',
      factor: 'poor_visibility',
      severity: 'high',
      value: true,
      description: `Poor visibility conditions detected`
    })
  }

  // Temperature extremes
  if (environmentData?.temperature || trafficData?.temperature) {
    const temp = environmentData?.temperature || trafficData?.temperature
    if (temp < 0) {
      environmentRisk += 15
      riskFactors.push({
        category: 'environment',
        factor: 'freezing_temperature',
        severity: 'high',
        value: temp,
        description: `Freezing temperature (${temp}°C) may cause ice formation`
      })
    } else if (temp > 35) {
      environmentRisk += 10
      riskFactors.push({
        category: 'environment',
        factor: 'extreme_heat',
        severity: 'medium',
        value: temp,
        description: `High temperature (${temp}°C) may affect driver alertness`
      })
    }
  }

  // Road condition
  const roadCondition = environmentData?.road_condition || 
                       trafficData?.road_condition

  if (roadCondition) {
    switch (roadCondition.toLowerCase()) {
      case 'wet':
        environmentRisk += 10
        riskFactors.push({
          category: 'environment',
          factor: 'wet_road',
          severity: 'medium',
          value: roadCondition,
          description: `Wet road conditions reduce tire grip`
        })
        break
      case 'icy':
      case 'snowy':
        environmentRisk += 25
        riskFactors.push({
          category: 'environment',
          factor: 'hazardous_road',
          severity: 'critical',
          value: roadCondition,
          description: `Hazardous road conditions require extreme caution`
        })
        break
    }
  }

  // === INCIDENT HISTORY RISK FACTORS (20% weight) ===
  let incidentRisk = 0

  if (alertsData && alertsData.length > 0) {
    // Recent alerts in the area
    const recentAlerts = alertsData.filter(alert => {
      const alertTime = new Date(alert.timestamp)
      const now = new Date()
      const timeDiff = (now - alertTime) / (1000 * 60) // minutes
      return timeDiff <= 60 // alerts within last hour
    })

    if (recentAlerts.length > 5) {
      incidentRisk += 25
      riskFactors.push({
        category: 'incidents',
        factor: 'multiple_recent_alerts',
        severity: 'high',
        value: recentAlerts.length,
        description: `${recentAlerts.length} alerts in the last hour indicate high activity area`
      })
    } else if (recentAlerts.length > 2) {
      incidentRisk += 15
      riskFactors.push({
        category: 'incidents',
        factor: 'some_recent_alerts',
        severity: 'medium',
        value: recentAlerts.length,
        description: `${recentAlerts.length} recent alerts in the area`
      })
    }

    // High severity alerts
    const highSeverityAlerts = recentAlerts.filter(alert => 
      alert.severity === 'high' || alert.severity === 'critical'
    )

    if (highSeverityAlerts.length > 0) {
      incidentRisk += 20
      riskFactors.push({
        category: 'incidents',
        factor: 'high_severity_alerts',
        severity: 'high',
        value: highSeverityAlerts.length,
        description: `${highSeverityAlerts.length} high-severity alert(s) active`
      })
    }
  }

  // === CALCULATE FINAL RISK SCORE ===
  riskScore = Math.min(
    (trafficRisk * weights.traffic) +
    (intersectionRisk * weights.intersection) +
    (environmentRisk * weights.environment) +
    (incidentRisk * weights.incidents),
    100
  )

  // Determine risk level
  let riskLevel = 'low'
  if (riskScore >= 80) riskLevel = 'critical'
  else if (riskScore >= 60) riskLevel = 'high'
  else if (riskScore >= 40) riskLevel = 'medium'

  return {
    riskScore: Math.round(riskScore * 100) / 100,
    riskLevel,
    riskFactors,
    breakdown: {
      traffic: Math.round(trafficRisk * weights.traffic * 100) / 100,
      intersection: Math.round(intersectionRisk * weights.intersection * 100) / 100,
      environment: Math.round(environmentRisk * weights.environment * 100) / 100,
      incidents: Math.round(incidentRisk * weights.incidents * 100) / 100
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Simplified risk score calculation for backward compatibility
 * @param {Object} data - Traffic data object
 * @returns {number} Risk score (0-100)
 */
function calculateRiskScoreV1(data) {
  let risk = 0

  // Speed risk
  if (data.speed < 15) risk += 25
  else if (data.speed > 80) risk += 20

  // Density risk
  if (data.density > 80) risk += 20
  else if (data.density > 60) risk += 10

  // Incident risk
  if (data.incident_detected) risk += 30

  // Weather risk
  if (data.weather_conditions === 'rain') risk += 15
  else if (data.weather_conditions === 'fog') risk += 20

  // Congestion risk
  if (data.congestion_level === 'high') risk += 15
  else if (data.congestion_level === 'medium') risk += 8

  return Math.min(risk, 100)
}

/**
 * Identify specific risk factors from data
 * @param {Object} data - Combined traffic and intersection data
 * @returns {Array} Array of risk factor objects
 */
function identifyRiskFactors(data) {
  const factors = []

  // Traffic flow factors
  if (data.speed < 20) {
    factors.push({
      type: 'slow_traffic',
      severity: 'medium',
      description: `Low speed (${data.speed} km/h) indicates congestion`
    })
  }

  if (data.density > 70) {
    factors.push({
      type: 'high_density',
      severity: 'high',
      description: `High traffic density (${data.density})`
    })
  }

  // Safety factors
  if (data.incident_detected) {
    factors.push({
      type: 'active_incident',
      severity: 'critical',
      description: 'Active traffic incident detected'
    })
  }

  if (data.risky_behavior_detected) {
    factors.push({
      type: 'risky_behavior',
      severity: 'high',
      description: 'Aggressive driving behavior detected'
    })
  }

  // Environmental factors
  if (data.weather_conditions && data.weather_conditions !== 'clear') {
    factors.push({
      type: 'adverse_weather',
      severity: data.weather_conditions === 'rain' ? 'medium' : 'high',
      description: `Weather: ${data.weather_conditions}`
    })
  }

  return factors
}

/**
 * Analyze risk patterns over time
 * @param {Array} historicalData - Array of historical risk data
 * @returns {Object} Pattern analysis results
 */
function analyzeRiskPatterns(historicalData) {
  if (!historicalData || historicalData.length === 0) {
    return {
      patterns: [],
      trends: {},
      recommendations: []
    }
  }

  const patterns = []
  const hourlyRisk = {}
  const dayOfWeekRisk = {}

  // Analyze hourly patterns
  historicalData.forEach(record => {
    const date = new Date(record.timestamp)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()

    if (!hourlyRisk[hour]) hourlyRisk[hour] = []
    if (!dayOfWeekRisk[dayOfWeek]) dayOfWeekRisk[dayOfWeek] = []

    hourlyRisk[hour].push(record.riskScore || 0)
    dayOfWeekRisk[dayOfWeek].push(record.riskScore || 0)
  })

  // Find peak risk hours
  const hourlyAverages = Object.keys(hourlyRisk).map(hour => ({
    hour: parseInt(hour),
    avgRisk: hourlyRisk[hour].reduce((a, b) => a + b, 0) / hourlyRisk[hour].length
  })).sort((a, b) => b.avgRisk - a.avgRisk)

  if (hourlyAverages.length > 0) {
    patterns.push({
      type: 'peak_risk_hour',
      description: `Highest risk typically occurs at ${hourlyAverages[0].hour}:00`,
      severity: hourlyAverages[0].avgRisk > 60 ? 'high' : 'medium',
      value: hourlyAverages[0].avgRisk
    })
  }

  // Find peak risk days
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dailyAverages = Object.keys(dayOfWeekRisk).map(day => ({
    day: parseInt(day),
    dayName: dayNames[parseInt(day)],
    avgRisk: dayOfWeekRisk[day].reduce((a, b) => a + b, 0) / dayOfWeekRisk[day].length
  })).sort((a, b) => b.avgRisk - a.avgRisk)

  if (dailyAverages.length > 0) {
    patterns.push({
      type: 'peak_risk_day',
      description: `Highest risk typically occurs on ${dailyAverages[0].dayName}`,
      severity: dailyAverages[0].avgRisk > 60 ? 'high' : 'medium',
      value: dailyAverages[0].avgRisk
    })
  }

  return {
    patterns,
    hourlyAverages,
    dailyAverages,
    totalRecords: historicalData.length
  }
}

module.exports = {
  calculateRiskScore,
  calculateRiskScoreV1,
  identifyRiskFactors,
  analyzeRiskPatterns
}
