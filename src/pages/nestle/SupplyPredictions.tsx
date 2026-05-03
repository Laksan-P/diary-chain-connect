import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, AlertTriangle, Info, MapPin, Loader2, BarChart3 } from 'lucide-react';
import { getPredictions } from '@/services/api';
import type { PredictionData } from '@/types';
import StatCard from '@/components/StatCard';

const SupplyPredictions: React.FC = () => {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPredictions()
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load predictions:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Generating supply forecasts...</p>
      </div>
    );
  }

  if (!data) return null;

  // Merge actual and forecast into a continuous timeline for better charting
  const allWeeks = Array.from(new Set([
    ...data.actualData.map(d => d.week),
    ...data.forecastData.map(d => d.week)
  ])).sort();

  const combinedTrend = allWeeks.map(week => {
    const actual = data.actualData.find(d => d.week === week)?.value;
    const predicted = data.forecastData.find(d => d.week === week)?.value;
    return { week, actual, predicted };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Smart Supply Prediction</h2>
          <p className="text-sm text-muted-foreground">Demand-Supply forecasting using Weighted Moving Average (WMA)</p>
        </div>
      </div>

      {/* Alerts Section */}
      {data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-xl border flex items-start gap-4 ${
                alert.type === 'Red' 
                  ? 'bg-destructive/10 border-destructive/20 text-destructive' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">{alert.level} Supply Warning</h4>
                <p className="text-sm opacity-90">{alert.message}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Current Weekly Average" 
          value={`${Math.round(data.actualData.reduce((a,b)=>a+b.value, 0) / data.actualData.length).toLocaleString()} L`} 
          icon={BarChart3} 
        />
        <StatCard 
          title="Predicted Next Week" 
          value={`${data.forecastData[0].value.toLocaleString()} L`} 
          icon={TrendingUp} 
          variant={data.forecastData[0].value < (data.actualData.reduce((a,b)=>a+b.value, 0) / data.actualData.length) * 0.8 ? 'danger' : 'success'}
        />
        <StatCard 
          title="Forecast Horizon" 
          value="4 Weeks" 
          icon={Info} 
          variant="default"
        />
      </div>

      {/* Charts Row 1: Actual vs Predicted */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div 
          className="xl:col-span-2 glass-card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-foreground">Supply Trend & Forecast</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary" /> Actual</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary/60" /> Predicted</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={combinedTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 11 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="hsl(209 100% 29%)" 
                strokeWidth={3} 
                dot={{ r: 4, fill: 'hsl(209 100% 29%)' }} 
                name="Actual Supply (L)"
              />
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="hsl(209 100% 29%)" 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={{ r: 4, fill: '#fff', stroke: 'hsl(209 100% 29%)', strokeWidth: 2 }} 
                name="Predicted Supply (L)"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div 
          className="glass-card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-display font-semibold text-foreground mb-6">Weekly Forecast</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.forecastData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '12px' }} />
              <Bar dataKey="value" fill="hsl(209 100% 29%)" radius={[6, 6, 0, 0]} name="Predicted (L)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <p>Weighted Moving Average (WMA) assigns 2.5x more weight to the most recent 4 weeks to capture current seasonality.</p>
          </div>
        </motion.div>
      </div>

      {/* Center-wise Predictions */}
      <div className="space-y-4">
        <h3 className="text-lg font-display font-bold text-foreground">Center-wise Forecasts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.centerPredictions.map((center, idx) => (
            <motion.div 
              key={center.centerId}
              className="glass-card p-5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-sm truncate">{center.name}</h4>
              </div>
              <div className="space-y-2">
                {center.predictions.map((p, pIdx) => (
                  <div key={p.week} className={`flex justify-between items-center text-xs py-1.5 ${pIdx === 0 ? 'border-b border-dashed mb-1' : ''}`}>
                    <span className="text-muted-foreground font-medium">{p.week}</span>
                    <span className={`font-bold ${pIdx === 0 ? 'text-primary' : 'text-foreground'}`}>
                      {p.value.toLocaleString()} L
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SupplyPredictions;
