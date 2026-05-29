import React, { useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Info,
  Phone,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getCollections, getFarmers, getFarmerPerformance } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Farmer, MilkCollection } from '@/types';
import {
  PASS_RATE_THRESHOLD,
  attentionReasonLabel,
  formatPassRate,
  formatTrendPassRate,
  formatVolumeLiters,
  getAttentionSeverity,
  getFailedCollectionCount,
  getFarmerAttentionReasons,
  getLatestQualityStatus,
  getListBadgeClasses,
  getQualityCardClasses,
  getQualityTone,
  getStatusCardClasses,
  hasEnoughTrendMonths,
} from '@/lib/performanceAnalytics';

type FarmerPerf = Awaited<ReturnType<typeof getFarmerPerformance>>;

const CCFarmerPerformance: React.FC = () => {
  const { user } = useAuth();
  const centerId = user?.chillingCenterId;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: farmers = [], isLoading: loadingFarmers } = useQuery({
    queryKey: ['cc_performance_farmers', centerId],
    queryFn: () => getFarmers(centerId),
    enabled: !!centerId,
  });

  const assignedFarmers = useMemo(
    () => farmers.filter((f) => f.chillingCenterId === centerId),
    [farmers, centerId],
  );

  const { data: collections = [], isLoading: loadingCollections } = useQuery({
    queryKey: ['cc_performance_collections', centerId],
    queryFn: () => getCollections(centerId),
    enabled: !!centerId,
  });

  const performanceQueries = useQueries({
    queries: assignedFarmers.map((f) => ({
      queryKey: ['cc_farmer_performance', f.id],
      queryFn: () => getFarmerPerformance(f.id),
      enabled: !!f.id,
    })),
  });

  const performanceByFarmerId = useMemo(() => {
    const map = new Map<number, FarmerPerf>();
    assignedFarmers.forEach((f, i) => {
      const data = performanceQueries[i]?.data;
      if (data) map.set(f.id, data);
    });
    return map;
  }, [assignedFarmers, performanceQueries]);

  const collectionsByFarmer = useMemo(() => {
    const map = new Map<number, MilkCollection[]>();
    for (const col of collections) {
      if (col.chillingCenterId !== centerId) continue;
      const list = map.get(col.farmerId) ?? [];
      list.push(col);
      map.set(col.farmerId, list);
    }
    return map;
  }, [collections, centerId]);

  const attentionFarmers = useMemo(() => {
    return assignedFarmers
      .map((farmer) => {
        const perf = performanceByFarmerId.get(farmer.id);
        const farmerCols = collectionsByFarmer.get(farmer.id) ?? [];
        const reasons = getFarmerAttentionReasons(perf, farmerCols);
        return { farmer, perf, reasons, farmerCols };
      })
      .filter((entry) => entry.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length);
  }, [assignedFarmers, performanceByFarmerId, collectionsByFarmer]);

  const selectedFarmer = assignedFarmers.find((f) => f.id === selectedId);
  const detailedPerf = selectedId ? performanceByFarmerId.get(selectedId) : undefined;
  const selectedCollections = selectedId ? collectionsByFarmer.get(selectedId) ?? [] : [];
  const loadingPerformance = performanceQueries.some((q) => q.isLoading);

  const inspectedCount = detailedPerf?.inspectedCount ?? 0;
  const passedCount = detailedPerf?.passedCount ?? 0;
  const passRateDisplay = detailedPerf?.passRateDisplay ?? detailedPerf?.passRate;
  const qualityTone = getQualityTone(passRateDisplay, inspectedCount);
  const qualityClasses = getQualityCardClasses(qualityTone);
  const trendData = detailedPerf?.trends ?? [];
  const enoughTrendHistory = hasEnoughTrendMonths(trendData);
  const qualityChartData = trendData.filter((t: { passRate?: number | null }) => t.passRate != null);
  const latestQuality = getLatestQualityStatus(selectedCollections);
  const failedCount = getFailedCollectionCount(inspectedCount, passedCount);

  const handleCall = (phone?: string) => {
    if (!phone?.trim()) return;
    window.location.href = `tel:${phone.trim()}`;
  };

  if (!centerId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No chilling center assigned to this account.
      </div>
    );
  }

  const isLoading = loadingFarmers || loadingCollections || loadingPerformance;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Farmer Performance Analytics</h2>
        <p className="text-muted-foreground">
          Monitor assigned farmers using the same Nestlé performance calculations. Only farmers linked to{' '}
          <span className="font-medium text-foreground">{user?.chillingCenterName || 'your center'}</span>{' '}
          are shown.
        </p>
      </div>

      {/* Farmers Requiring Attention */}
      <Card className="border-amber-200/60 dark:border-amber-900/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Farmers Requiring Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : attentionFarmers.length === 0 ? (
            <div className="flex items-center gap-3 text-muted-foreground py-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p>All assigned farmers are within acceptable performance thresholds.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attentionFarmers.map(({ farmer, perf, reasons }) => {
                const severity = getAttentionSeverity(reasons.length);
                const borderClass =
                  severity === 'critical'
                    ? 'border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-amber-300 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20';

                return (
                  <div
                    key={farmer.id}
                    className={`rounded-xl border p-4 ${borderClass} flex flex-col gap-3`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{farmer.name}</p>
                        <p className="text-xs text-muted-foreground">{farmer.farmerId}</p>
                      </div>
                      <Badge variant="outline" className={getListBadgeClasses(perf?.status ?? farmer.performance_status ?? '', 'farmer')}>
                        {perf?.status ?? farmer.performance_status ?? 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {reasons.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {attentionReasonLabel(r)}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <span className="text-xs text-muted-foreground truncate">{farmer.phone || 'No phone'}</span>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSelectedId(farmer.id)}>
                          View
                        </Button>
                        {farmer.phone && (
                          <Button size="sm" className="h-8 gap-1" onClick={() => handleCall(farmer.phone)}>
                            <Phone className="w-3 h-3" />
                            Call
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Farmer list */}
        <Card className="lg:col-span-1 h-[calc(100vh-180px)] min-h-[640px] flex flex-col">
          <CardHeader className="py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Assigned Farmers ({assignedFarmers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0 border-t">
            {loadingFarmers ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : assignedFarmers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No farmers assigned to this center.</p>
            ) : (
              <div className="divide-y">
                {assignedFarmers.map((f) => {
                  const perf = performanceByFarmerId.get(f.id);
                  const reasons = getFarmerAttentionReasons(perf, collectionsByFarmer.get(f.id) ?? []);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      className={`w-full text-left py-5 px-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${
                        selectedId === f.id ? 'bg-primary/5 border-r-4 border-primary' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{f.farmerId}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase mt-1 ${getListBadgeClasses(perf?.status ?? f.performance_status ?? '', 'farmer')}`}
                        >
                          {perf?.status ?? f.performance_status ?? '—'}
                        </Badge>
                        {reasons.length > 0 && (
                          <Badge variant="destructive" className="text-[9px] ml-1 mt-1">
                            Attention
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedId || !selectedFarmer ? (
            <div className="h-full min-h-[640px] flex flex-col items-center justify-center text-muted-foreground p-12 border-2 border-dashed rounded-xl">
              <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a farmer to view performance analytics.</p>
            </div>
          ) : !detailedPerf ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              {/* Farmer header + call */}
              <Card>
                <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold">{selectedFarmer.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Farmer ID: {selectedFarmer.farmerId} · Phone: {selectedFarmer.phone || 'Not set'}
                    </p>
                  </div>
                  {selectedFarmer.phone && (
                    <Button className="gap-2 shrink-0" onClick={() => handleCall(selectedFarmer.phone)}>
                      <Phone className="w-4 h-4" />
                      Call Farmer
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Stats row */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Quality Pass Rate</p>
                    <h3 className="text-2xl font-bold">
                      {inspectedCount > 0 ? formatPassRate(passRateDisplay) : 'Not Enough Data'}
                    </h3>
                    {inspectedCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {PASS_RATE_THRESHOLD}% threshold · {inspectedCount} inspected
                      </p>
                    )}
                    {inspectedCount > 0 && (
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${qualityClasses.bar}`}
                          style={{ width: `${Math.min(passRateDisplay ?? 0, 100)}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Performance Status</p>
                    <h3 className="text-2xl font-bold">{detailedPerf.status}</h3>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Nestlé-inspected collections
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Supply Frequency</p>
                    <h3 className="text-2xl font-bold">{detailedPerf.frequency}</h3>
                    <p className="text-xs text-muted-foreground mt-2">{detailedPerf.frequencySubtext}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Latest Quality Status</p>
                    <h3 className="text-2xl font-bold">{latestQuality}</h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      Passed: {passedCount} · Failed: {failedCount}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Volume Trend (Monthly)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] relative">
                      {!enoughTrendHistory ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-6">
                          <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                          <p>Not enough monthly history for trend (need 2+ months).</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendData}>
                            <defs>
                              <linearGradient id="ccColorVol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0d47a1" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#0d47a1" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              formatter={(value: number) => [`${value} L`, 'Quantity']}
                            />
                            <Area
                              type="monotone"
                              dataKey="volume"
                              stroke="#0d47a1"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#ccColorVol)"
                              name="Quantity (L)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Quality Pass Rate Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] relative">
                      {qualityChartData.length < 2 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-6">
                          <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                          <p>Need 2+ months of inspected collections for quality trend.</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={qualityChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              formatter={(value: number) => [formatTrendPassRate(value), 'Pass Rate']}
                            />
                            <Bar dataKey="passRate" fill="#10b981" radius={[4, 4, 0, 0]} name="Pass Rate" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Collection breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Quality Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-muted-foreground text-xs">Inspected</p>
                      <p className="text-lg font-bold">{inspectedCount}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
                      <p className="text-muted-foreground text-xs">Passed</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{passedCount}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                      <p className="text-muted-foreground text-xs">Failed</p>
                      <p className="text-lg font-bold text-red-700 dark:text-red-400">{failedCount}</p>
                    </div>
                    <div className={`rounded-lg p-3 ${getStatusCardClasses(detailedPerf.status)}`}>
                      <p className="text-xs opacity-80">Status</p>
                      <p className="text-lg font-bold">{detailedPerf.status}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CCFarmerPerformance;
