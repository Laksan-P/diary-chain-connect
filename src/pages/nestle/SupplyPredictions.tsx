import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, Info, MapPin, Loader2, BarChart3 } from 'lucide-react';
import { getPredictions } from '@/services/api';
import type { PredictionData } from '@/types';
import StatCard from '@/components/StatCard';

const formatLiters = (value: number | null | undefined) => {
  if (value == null) return 'Not enough data';
  return `${Math.round(value).toLocaleString()} L`;
};

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

  const hasMonthlyForecast = (data.forecast?.monthly?.length ?? 0) > 0;
  const hasWeeklyForecast = (data.forecast?.weekly?.length ?? 0) > 0;
  const notEnoughData = !!data.message && !hasMonthlyForecast;
  const nextWeek = data.forecast?.nextWeek ?? null;

  const monthlyChartData = [
    ...data.history.monthly.slice(-12).map(entry => ({
      period: entry.period,
      actual: entry.totalLiters,
      predicted: null as number | null,
    })),
    ...(data.forecast?.monthly ?? []).map(entry => ({
      period: entry.period,
      actual: null as number | null,
      predicted: entry.predictedLiters,
    })),
  ];

  const lastActualWeek =
    data.history.weekly.length > 0
      ? data.history.weekly[data.history.weekly.length - 1].period
      : null;

  const weeklyChartData = Array.from(
    new Set([
      ...data.history.weekly.slice(-12).map(entry => entry.period),
      ...(data.forecast?.weekly ?? []).map(entry => entry.period),
    ])
  )
    .sort()
    .map(period => {
      const actual = data.history.weekly.find(entry => entry.period === period)?.totalLiters ?? null;
      let predicted =
        data.forecast?.weekly.find(entry => entry.period === period)?.predictedLiters ?? null;
      if (period === lastActualWeek && actual != null) {
        predicted = actual;
      }
      return { period, actual, predicted };
    });

  const trendChartData = hasMonthlyForecast ? monthlyChartData : weeklyChartData;
  const trendXKey = hasMonthlyForecast ? 'period' : 'period';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Smart Supply Prediction</h2>
          <p className="text-sm text-muted-foreground">
            Demand-Supply forecasting using Weighted Moving Average (WMA) and seasonal trends
          </p>
        </div>
      </div>

      {notEnoughData && (
        <div className="p-4 rounded-xl border bg-muted/40 border-border flex items-start gap-4">
          <Info className="w-5 h-5 mt-0.5 text-muted-foreground" />
          <div>
            <h4 className="font-bold text-sm">Not enough supply history for prediction.</h4>
            <p className="text-sm text-muted-foreground mt-1">{data.message}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Add at least 3 months of valid collection data to generate a forecast.
            </p>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Current Weekly Average"
          value={formatLiters(data.summary.currentWeeklyAverage)}
          icon={BarChart3}
        />
        <StatCard
          title="Predicted Next Week"
          value={
            nextWeek
              ? formatLiters(nextWeek.predictedLiters)
              : 'Not enough weekly history for prediction.'
          }
          icon={TrendingUp}
          variant={
            nextWeek && data.summary.currentWeeklyAverage != null &&
            data.summary.currentWeeklyAverage > 0 &&
            nextWeek.predictedLiters < data.summary.currentWeeklyAverage * 0.7
              ? 'danger'
              : nextWeek
                ? 'success'
                : 'default'
          }
        />
        <StatCard
          title="Forecast Horizon"
          value={data.summary.forecastHorizon}
          icon={Info}
          variant="default"
        />
        <StatCard
          title="Forecast Confidence"
          value={data.summary.confidence}
          icon={Info}
          variant={
            data.summary.confidence === 'High'
              ? 'success'
              : data.summary.confidence === 'Not Available'
                ? 'default'
                : 'warning'
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div
          className="xl:col-span-2 glass-card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-foreground">Supply Trend & Forecast</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-primary" /> Actual
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-primary/60" /> Predicted
              </div>
            </div>
          </div>

          {trendChartData.length === 0 ? (
            <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-6">
              <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
              <p>Not enough supply history for prediction.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey={trendXKey} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={value => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: number, name: string) => [
                    value != null ? `${Math.round(value).toLocaleString()} L` : '—',
                    name,
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(209 100% 29%)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(209 100% 29%)' }}
                  connectNulls={false}
                  name="Actual Supply (L)"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(209 100% 29%)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#fff', stroke: 'hsl(209 100% 29%)', strokeWidth: 2 }}
                  connectNulls={false}
                  name="Predicted Supply (L)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-display font-semibold text-foreground mb-6">
            {hasMonthlyForecast ? 'Monthly Forecast' : 'Weekly Forecast'}
          </h3>

          {!hasMonthlyForecast && !hasWeeklyForecast ? (
            <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-4">
              <Info className="w-8 h-8 mb-2 opacity-30" />
              <p>Not enough supply history for prediction.</p>
              <p className="text-xs mt-2">
                Add at least 3 months of valid collection data to generate a forecast.
              </p>
            </div>
          ) : hasMonthlyForecast ? (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {data.forecast.monthly.map((entry, index) => (
                <div
                  key={entry.period}
                  className={`flex justify-between items-center text-sm py-2 px-3 rounded-lg ${
                    index === 0 ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30'
                  }`}
                >
                  <div>
                    <p className="font-medium">{entry.period}</p>
                    <p className="text-xs text-muted-foreground">{entry.confidence} confidence</p>
                  </div>
                  <span className="font-bold">{entry.predictedLiters.toLocaleString()} L</span>
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.forecast.weekly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={value => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '12px' }}
                  formatter={(value: number) => [`${Math.round(value).toLocaleString()} L`, 'Predicted']}
                />
                <Bar dataKey="predictedLiters" fill="hsl(209 100% 29%)" radius={[6, 6, 0, 0]} name="Predicted (L)" />
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <p>
              WMA weights recent periods more heavily. With 12+ months of history, seasonal same-month patterns are blended into monthly forecasts.
            </p>
          </div>
        </motion.div>
      </div>

      {data.centerPredictions.length > 0 && (
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
                {center.predictions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Not enough weekly history for prediction.</p>
                ) : (
                  <div className="space-y-2">
                    {center.predictions.map((p, pIdx) => (
                      <div
                        key={p.week}
                        className={`flex justify-between items-center text-xs py-1.5 ${
                          pIdx === 0 ? 'border-b border-dashed mb-1' : ''
                        }`}
                      >
                        <span className="text-muted-foreground font-medium">{p.week}</span>
                        <span className={`font-bold ${pIdx === 0 ? 'text-primary' : 'text-foreground'}`}>
                          {p.value.toLocaleString()} L
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplyPredictions;
