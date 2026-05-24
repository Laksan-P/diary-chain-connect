import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  TrendingUp, AlertCircle, CheckCircle2, 
  BarChart3, Users, ChevronRight, Info, Lightbulb
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { getAllPerformance, getFarmerPerformance, getCenterPerformanceDetailed, syncFarmerPerformance } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatPassRate,
  formatTrendPassRate,
  formatVolumeLiters,
  getListBadgeClasses,
  getQualityCardClasses,
  getQualityTone,
  getStatusCardClasses,
  hasEnoughTrendMonths,
  PASS_RATE_THRESHOLD,
} from '@/lib/performanceAnalytics';

const PerformanceDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: allStats, isLoading: loadingAll } = useQuery({
    queryKey: ['performance_all'],
    queryFn: getAllPerformance
  });

  const [selectedType, setSelectedType] = React.useState<'farmer' | 'center'>('farmer');
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);

  const { data: detailedPerf, isLoading: loadingDetail } = useQuery({
    queryKey: ['performance_detail', selectedType, selectedId],
    queryFn: () => selectedType === 'farmer' 
      ? getFarmerPerformance(selectedId!) 
      : getCenterPerformanceDetailed(selectedId!),
    enabled: !!selectedId
  });

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncFarmerPerformance();
      toast({
        title: 'Sync Complete',
        description: `Successfully updated performance for ${res.updatedCount} farmers.`
      });
      await queryClient.invalidateQueries({ queryKey: ['performance_all'] });
      await queryClient.invalidateQueries({ queryKey: ['performance_detail'] });
    } catch (err: any) {
      toast({
        title: 'Sync Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const inspectedCount = detailedPerf?.inspectedCount ?? 0;
  const passRateDisplay = detailedPerf?.passRateDisplay ?? detailedPerf?.passRate;
  const qualityTone = getQualityTone(passRateDisplay, inspectedCount);
  const qualityClasses = getQualityCardClasses(qualityTone);
  const trendData = detailedPerf?.trends ?? [];
  const enoughTrendHistory = hasEnoughTrendMonths(trendData);
  const qualityChartData = trendData.filter((t: { passRate?: number | null }) => t.passRate != null);
  const recommendations: string[] = detailedPerf?.recommendations ?? [];

  if (loadingAll) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Tracking</h2>
          <p className="text-muted-foreground">Automated supply monitoring and quality analytics.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleSync} 
          disabled={syncing}
          className="flex items-center gap-2"
        >
          {syncing ? (
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          Sync All History
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar List */}
        <Card className="lg:col-span-1 h-[calc(100vh-200px)] flex flex-col">
          <CardHeader className="py-4">
            <Tabs value={selectedType} onValueChange={(v: any) => { setSelectedType(v); setSelectedId(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="farmer" className="text-xs">Farmers</TabsTrigger>
                <TabsTrigger value="center" className="text-xs">Chilling Centers</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0 border-t">
            <div className="divide-y">
              {selectedType === 'farmer' ? (
                allStats?.farmers?.map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between ${selectedId === f.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{f.name}</p>
                      <Badge variant="outline" className={`text-[10px] uppercase mt-1 ${getListBadgeClasses(f.performance_status, 'farmer')}`}>
                        {f.performance_status}
                      </Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))
              ) : (
                allStats?.centers?.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between ${selectedId === c.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <Badge variant="outline" className={`text-[10px] uppercase mt-1 ${getListBadgeClasses(c.performance_status, 'center')}`}>
                        {c.performance_status}
                      </Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details View */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedId ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 border-2 border-dashed rounded-xl">
              <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a {selectedType} from the list to view performance analytics.</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              {/* Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Quality Pass Rate</p>
                        <h3 className="text-2xl font-bold">
                          {inspectedCount > 0 ? formatPassRate(passRateDisplay) : 'Not Enough Data'}
                        </h3>
                        {inspectedCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {PASS_RATE_THRESHOLD}% threshold · {inspectedCount} inspected
                          </p>
                        )}
                      </div>
                      <div className={`p-2 rounded-full ${qualityClasses.icon}`}>
                        {qualityTone === 'success' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : qualityTone === 'warning' ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <Info className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                    {inspectedCount > 0 && (
                      <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${qualityClasses.bar}`}
                          style={{ width: `${Math.min(passRateDisplay ?? 0, 100)}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Performance Status</p>
                        <h3 className="text-2xl font-bold">{detailedPerf.status}</h3>
                      </div>
                      <div className={`p-2 rounded-full ${getStatusCardClasses(detailedPerf.status)}`}>
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Based on Nestlé-inspected collections
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Supply Frequency</p>
                        <h3 className="text-2xl font-bold">{detailedPerf.frequency}</h3>
                      </div>
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{detailedPerf.frequencySubtext}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.map((tip, i) => (
                        <li key={i} className="text-sm flex items-start gap-3 text-muted-foreground">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                            detailedPerf.status === 'Good' ? 'bg-emerald-500' :
                            detailedPerf.status === 'Not Enough Data' ? 'bg-slate-400' :
                            'bg-amber-500'
                          }`} />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

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
                          <p>
                            Not enough monthly history for trend. Add approved collections across at least 2 different months to view the trend.
                          </p>
                          {trendData.length >= 1 && (
                            <p className="text-xs mt-2 text-foreground/70">
                              {trendData[trendData.length - 1].month}: {formatVolumeLiters(trendData[trendData.length - 1].volume)} total
                            </p>
                          )}
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart key={`vol-${selectedId}`} data={trendData}>
                            <defs>
                              <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0d47a1" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#0d47a1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              formatter={(value: number) => [`${value} L`, 'Quantity']}
                            />
                            <Area type="monotone" dataKey="volume" stroke="#0d47a1" strokeWidth={2} fillOpacity={1} fill="url(#colorVol)" name="Quantity (L)" />
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
                          <p>
                            Not enough monthly inspection history for trend. At least 2 months of Nestlé-inspected collections are required.
                          </p>
                          {qualityChartData.length >= 1 && (
                            <p className="text-xs mt-2 text-foreground/70">
                              {qualityChartData[qualityChartData.length - 1].month}: {formatTrendPassRate(qualityChartData[qualityChartData.length - 1].passRate)} pass rate
                            </p>
                          )}
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart key={`qual-${selectedId}`} data={qualityChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              formatter={(value: number) => [formatTrendPassRate(value), 'Pass Rate']}
                            />
                            <Bar 
                              dataKey="passRate" 
                              fill="#10b981"
                              radius={[4, 4, 0, 0]} 
                              name="Pass Rate %"
                              minPointSize={5}
                              label={{
                                position: 'top',
                                fontSize: 9,
                                fill: '#666',
                                formatter: (v: number) => formatTrendPassRate(v),
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
