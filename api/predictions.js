import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

// Helper to calculate next week string
function getNextWeekString(currentWeekStr) {
  const [yearStr, weekStr] = currentWeekStr.split('-W');
  let year = parseInt(yearStr);
  let week = parseInt(weekStr);
  week++;
  if (week > 52) { // simplification
    week = 1;
    year++;
  }
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Fetch last 12 months data
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    // We need chilling_center name as well, so join
    const { data: collections, error } = await supabase
      .from('milk_collections')
      .select('date, quantity, chilling_center_id, chilling_centers(name)')
      .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    // 2. Group Data
    // We need: total weekly supply, center-wise weekly supply
    const weeklyTotal = {}; // { '2023-W01': 1500, ... }
    const centerWeekly = {}; // { centerId: { name, weeks: { '2023-W01': 500, ... } } }
    
    // To ensure we have chronological weeks, keep track of all seen weeks
    const allWeeksSet = new Set();

    collections.forEach(col => {
      if (!col.quantity || !col.date) return;
      const dateObj = new Date(col.date);
      const weekStr = getWeekNumber(dateObj);
      allWeeksSet.add(weekStr);
      
      const qty = parseFloat(col.quantity);
      
      // Total
      weeklyTotal[weekStr] = (weeklyTotal[weekStr] || 0) + qty;
      
      // Center-wise
      const cid = col.chilling_center_id;
      if (cid) {
        if (!centerWeekly[cid]) {
          centerWeekly[cid] = { 
            name: col.chilling_centers?.name || `Center ${cid}`, 
            weeks: {} 
          };
        }
        centerWeekly[cid].weeks[weekStr] = (centerWeekly[cid].weeks[weekStr] || 0) + qty;
      }
    });

    const sortedWeeks = Array.from(allWeeksSet).sort();

    // 3. WMA Prediction Calculation
    // Function to calculate WMA for the next period
    const calculateWMA = (dataPoints) => {
      // Use last 12 weeks if available, else whatever is available
      const periods = Math.min(12, dataPoints.length);
      if (periods === 0) return 0;
      
      const recentData = dataPoints.slice(-periods);
      let weightSum = 0;
      let weightedSum = 0;
      
      for (let i = 0; i < periods; i++) {
        const weight = i + 1; // older data gets lower weight (1), recent gets highest (periods)
        weightSum += weight;
        weightedSum += recentData[i] * weight;
      }
      return weightedSum / weightSum;
    };

    // Calculate momentum trend to prevent flat-lining
    const calculateTrend = (dataPoints) => {
      if (dataPoints.length < 2) return 0;
      const recent = dataPoints.slice(-4); // Use last 4 weeks momentum
      if (recent.length < 2) return 0;
      const first = recent[0];
      const last = recent[recent.length - 1];
      return (last - first) / (recent.length - 1);
    };

    // Predict next 4 weeks for Total
    let totalDataPoints = sortedWeeks.map(w => weeklyTotal[w]);
    const totalPredictions = [];
    let currentWeekTotal = sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1] : getWeekNumber(new Date());

    let baseTotalWMA = calculateWMA(totalDataPoints);
    let totalTrend = calculateTrend(totalDataPoints);

    for (let i = 0; i < 4; i++) {
      currentWeekTotal = getNextWeekString(currentWeekTotal);
      let stepValue = baseTotalWMA + (totalTrend * (i + 1));
      if (stepValue < 0) stepValue = 0; // Prevent negative supply
      totalPredictions.push({ week: currentWeekTotal, value: Math.round(stepValue) });
    }

    // Predict next 4 weeks per center
    const centerWisePredictions = [];
    Object.keys(centerWeekly).forEach(cid => {
      const cInfo = centerWeekly[cid];
      let centerDataPoints = sortedWeeks.map(w => cInfo.weeks[w] || 0);
      const cPreds = [];
      let cWeekStr = sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1] : getWeekNumber(new Date());
      
      let baseCenterWMA = calculateWMA(centerDataPoints);
      let centerTrend = calculateTrend(centerDataPoints);
      
      for (let i = 0; i < 4; i++) {
        cWeekStr = getNextWeekString(cWeekStr);
        let stepValue = baseCenterWMA + (centerTrend * (i + 1));
        if (stepValue < 0) stepValue = 0;
        cPreds.push({ week: cWeekStr, value: Math.round(stepValue) });
      }
      centerWisePredictions.push({
        centerId: cid,
        name: cInfo.name,
        predictions: cPreds
      });
    });

    // Format actual data for charts
    const actualWeeklyData = sortedWeeks.map(w => ({
      week: w,
      value: Math.round(weeklyTotal[w])
    })).slice(-12); // Send last 12 weeks of actuals for UI clarity

    // 4. Alert System
    const alerts = [];
    // Calculate average of actuals to determine thresholds
    const last12Actuals = actualWeeklyData.map(d => d.value);
    const avgSupply = last12Actuals.length > 0 ? last12Actuals.reduce((a,b)=>a+b, 0) / last12Actuals.length : 0;
    
    if (avgSupply > 0) {
      const minThreshold = avgSupply * 0.8; // 20% drop
      const maxThreshold = avgSupply * 1.5; // 50% spike
      
      const nextWeekPred = totalPredictions[0].value;
      
      if (nextWeekPred < minThreshold) {
        const msg = `Critical Warning: Predicted supply for ${totalPredictions[0].week} (${nextWeekPred}L) is dangerously low. Expected minimum is ${Math.round(minThreshold)}L.`;
        alerts.push({ level: 'Critical', type: 'Red', message: msg });
      } else if (nextWeekPred > maxThreshold) {
        const msg = `Capacity Warning: Predicted supply for ${totalPredictions[0].week} (${nextWeekPred}L) exceeds normal capacity. Expected maximum is ${Math.round(maxThreshold)}L.`;
        alerts.push({ level: 'Warning', type: 'Amber', message: msg });
      }

      // Store alerts in database if they are new
      if (alerts.length > 0) {
        const { data: nestleAdmins } = await supabase.from('users').select('id').eq('role', 'nestle');
        if (nestleAdmins && nestleAdmins.length > 0) {
          // Check if we already alerted today to avoid spamming
          const todayStr = new Date().toISOString().split('T')[0];
          const adminId = nestleAdmins[0].id;
          
          const { data: recentAlerts } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', adminId)
            .eq('type', 'prediction_alert')
            .gte('created_at', todayStr)
            .limit(1);

          if (!recentAlerts || recentAlerts.length === 0) {
            const insertPayload = alerts.map(a => ({
              user_id: adminId,
              title: a.level + ' Supply Forecast',
              message: a.message,
              type: 'prediction_alert',
              is_read: false
            }));
            await supabase.from('notifications').insert(insertPayload);
          }
        }
      }
    }

    // 5. Return Output
    return res.status(200).json({
      actualData: actualWeeklyData,
      forecastData: totalPredictions,
      centerPredictions: centerWisePredictions,
      alerts: alerts
    });

  } catch (err) {
    console.error('Predictions API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
