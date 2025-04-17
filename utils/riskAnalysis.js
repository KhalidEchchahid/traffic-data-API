// Risk score calculation logic
const calculateRiskScore = (data) => {
    let score = 0
  
    // Accident-related risks
    score += data.trafficData.incidentDetected ? 30 : 0
    score += data.trafficData.nearMissEvents * 5
    score += data.intersectionData.collisionCount * 20
  
    // Traffic conditions
    score += data.trafficData.congestionLevel === "high" ? 15 : 0
    score += data.intersectionData.queueLengthByLane.lane1 > 15 ? 10 : 0
  
    // Environmental factors
    score += data.trafficData.visibility === "poor" ? 20 : 0
    score += data.intersectionData.localWeatherConditions === "rain" ? 15 : 0
  
    return Math.min(score, 100)
  }
  
  function calculateRiskScoreV1(item) {
    let score = 0
  
    // Add weight for an incident if detected
    if (item.trafficData?.incidentDetected) {
      score += 50
    }
  
    // Add weight for near miss events from traffic data
    score += (item.trafficData?.nearMissEvents || 0) * 5
  
    // Add weight for collision count from intersection data
    score += (item.intersectionData?.collisionCount || 0) * 30
  
    // Add weight for risky behavior detected
    if (item.intersectionData?.riskyBehaviorDetected) {
      score += 20
    }
  
    // Add weight for near miss incidents in intersection data
    score += (item.intersectionData?.nearMissIncidents || 0) * 5
  
    // Add weight for sudden braking events in intersection data
    score += (item.intersectionData?.suddenBrakingEvents || 0) * 3
  
    // Instead of trafficData.lane1, use intersectionData.queueLengthByLane.lane1
    const lane1 = item.intersectionData?.queueLengthByLane?.lane1 ?? 0
    score += Number(lane1) * 2
  
    return score
  }
  
  // Risk factors identification
  const identifyRiskFactors = (data) => {
    const factors = []
  
    if (data.trafficData.incidentDetected) factors.push("active-incident")
    if (data.intersectionData.collisionCount > 0) factors.push("recent-collisions")
    if (data.trafficData.congestionLevel === "high") factors.push("high-congestion")
    if (data.trafficData.visibility === "poor") factors.push("poor-visibility")
    if (data.intersectionData.riskyBehaviorDetected) factors.push("risky-behavior")
  
    return factors
  }
  
  module.exports = {
    calculateRiskScore,
    calculateRiskScoreV1,
    identifyRiskFactors,
  }
  
  