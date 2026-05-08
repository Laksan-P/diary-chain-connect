import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, 
  BarChart3, Users, Building2, ChevronRight, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { getAllPerformance, getFarmerPerformance, getCenterPerformanceDetailed, syncFarmerPerformance } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const PerformanceDashboard: React.FC = () => {
  const { data: allStats, isLoading: loadingAll } = useQuery({
    queryKey: ['performance_all'],
    queryFn: getAllPerformance
  });

  const [selectedType, setSelectedType] = React.useState<'farmer' | 'center'>('farmer');
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);

  const { data: detailedPerf, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
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
      refetchDetail();
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
                      <Badge variant="outline" className={`text-[10px] uppercase mt-1 ${
                        f.performance_status === 'Good' ? 'bg-emerald-50 text-emerald-700' : 
                        f.performance_status === 'Improving' ? 'bg-blue-50 text-blue-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
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
                      <Badge variant="outline" className={`text-[10px] uppercase mt-1 ${
                        c.performance_status === 'Good' ? 'bg-emerald-50 text-emerald-700' : 
                        c.performance_status === 'Improving' ? 'bg-blue-50 text-blue-700' :
                        'bg-red-50 text-red-700'
                      }`}>
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
                        <h3 className="text-2xl font-bold">{detailedPerf.passRate.toFixed(1)}%</h3>
                      </div>
                      <div className={`p-2 rounded-full ${detailedPerf.passRate >= 75 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {detailedPerf.passRate >= 75 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </div>
                    </div>
                    <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${detailedPerf.passRate >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${detailedPerf.passRate}%` }} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Performance Status</p>
                        <h3 className="text-2xl font-bold">{detailedPerf.status}</h3>
                      </div>
                      <div className={`p-2 rounded-full ${
                        detailedPerf.status === 'Good' ? 'bg-emerald-100 text-emerald-600' : 
                        detailedPerf.status === 'Improving' ? 'bg-blue-100 text-blue-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" /> System calculated based on recent activity
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

              {/* Recommendation Alert - Hide if status is Good */}
              {detailedPerf.recommendation && detailedPerf.status !== 'Good' && (() => {
                let recData: any = null;
                try {
                  if (detailedPerf.recommendation.startsWith('{')) {
                    recData = JSON.parse(detailedPerf.recommendation);
                  }
                } catch (e) {}

                if (recData) {
                  return (
                    <Alert className={`${detailedPerf.status === 'Good' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} border-l-4 border-l-amber-500`}>
                      <Info className="h-5 w-5 text-amber-600" />
                      <div className="ml-2">
                        <AlertTitle className="text-lg font-bold text-amber-900">{recData.message_title}</AlertTitle>
                        <AlertDescription className="mt-2 space-y-4">
                          <p className="text-base font-medium text-amber-800">{recData.short_message}</p>
                          
                          <div className="bg-white/60 backdrop-blur-sm p-5 rounded-xl border border-amber-200 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              Guidance for Farmer
                            </p>
                            <ul className="grid grid-cols-1 gap-2">
                              {recData.tips?.map((tip: string, i: number) => (
                                <li key={i} className="text-sm flex items-start gap-3 text-amber-900/80">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="flex items-center gap-4 pt-2">
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                              Severity: {recData.severity || 'HIGH'}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                              Issue: {recData.issue || 'Quality'}
                            </Badge>
                          </div>
                        </AlertDescription>
                      </div>
                    </Alert>
                  );
                }

                return (
                  <Alert className={`${detailedPerf.status === 'Good' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Automated Recommendation</AlertTitle>
                    <AlertDescription className="text-sm font-medium">
                      {detailedPerf.recommendation}
                    </AlertDescription>
                  </Alert>
                );
              })()}

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
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart key={selectedId} data={detailedPerf.trends}>
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
                          />
                          <Area type="monotone" dataKey="volume" stroke="#0d47a1" strokeWidth={2} fillOpacity={1} fill="url(#colorVol)" name="Quantity (L)" />
                        </AreaChart>
                      </ResponsiveContainer>
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
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart key={selectedId} data={detailedPerf.trends}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                          <Bar 
                            dataKey="passRate" 
                            fill="#10b981"
                            radius={[4, 4, 0, 0]} 
                            name="Pass Rate %"
                            minPointSize={5}
                            label={{ position: 'top', fontSize: 8, fill: '#666', formatter: (v: number) => `${v}%` }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
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
