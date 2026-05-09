import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  AlertTriangle, CheckCircle2, Info, TrendingUp, Users,
  Droplets, Beaker, Zap
} from 'lucide-react';
import { getFarmers } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { motion } from 'framer-motion';

const NestleRecommendations: React.FC = () => {
  const { user } = useAuth();
  
  const { data: farmers, isLoading } = useQuery({
    queryKey: ['farmers_recommendations', user?.chillingCenterId],
    queryFn: () => getFarmers(user?.chillingCenterId),
    enabled: !!user?.chillingCenterId
  });

  const farmersWithIssues = farmers?.filter(f => f.performance_status === 'Needs Improvement') || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-display font-bold text-foreground">Nestlé Recommendations</h2>
          <p className="text-muted-foreground">Quality improvement guidance provided by Nestlé for your farmers.</p>
        </motion.div>
        {!isLoading && farmersWithIssues.length > 0 && (
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-primary/10 text-primary px-4 py-2 rounded-xl border border-primary/20 flex items-center gap-2 self-start md:self-auto"
          >
            <Users className="w-5 h-5" />
            <span className="font-bold">{farmersWithIssues.length} Farmers Alerted</span>
          </motion.div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : farmersWithIssues.length === 0 ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-dashed border-2 p-12 flex flex-col items-center justify-center text-center bg-muted/10">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <CardTitle className="text-xl">All Farmers Performing Well</CardTitle>
            <CardDescription className="max-w-md mt-2">
              There are currently no quality improvement recommendations from Nestlé for your farmers. All quality parameters (SNF, FAT, Water) are within acceptable limits.
            </CardDescription>
          </Card>
        </motion.div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {farmersWithIssues.map(farmer => {
            let recData: any = null;
            try {
              if (farmer.performance_recommendation?.startsWith('{')) {
                recData = JSON.parse(farmer.performance_recommendation);
              }
            } catch (e) {}

            const issues = recData?.issue?.split(',') || [];
            
            return (
              <motion.div key={farmer.id} variants={itemVariants}>
                <Card className="overflow-hidden border-amber-200 shadow-md hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                  <div className="bg-amber-500 h-1.5 w-full" />
                  <CardHeader className="bg-amber-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold">
                        {recData?.severity || 'HIGH'} SEVERITY
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground bg-white/50 px-2 py-0.5 rounded border">{farmer.farmerId}</span>
                    </div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {farmer.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {issues.includes('WATER') && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none flex gap-1 items-center py-1"><Droplets className="w-3 h-3" /> Water Failure</Badge>}
                      {issues.includes('SNF') && <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none flex gap-1 items-center py-1"><Beaker className="w-3 h-3" /> Low SNF</Badge>}
                      {issues.includes('FAT') && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none flex gap-1 items-center py-1"><Zap className="w-3 h-3" /> Low FAT</Badge>}
                      {issues.length === 0 && <Badge variant="secondary">General Quality Issue</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4 flex-1 flex flex-col">
                    <div className="space-y-2">
                      <h4 className="font-bold text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {recData?.message_title || 'Quality Improvement Required'}
                      </h4>
                      <p className="text-sm text-amber-800/80 leading-relaxed">
                        {recData?.short_message || 'Multiple quality parameters are failing in recent supplies.'}
                      </p>
                    </div>

                    <div className="bg-muted/30 p-5 rounded-xl border border-border/50 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Recommended Actions
                      </p>
                      <ul className="space-y-2.5">
                        {(recData?.tips || [
                          "Review feeding and nutrition",
                          "Maintain milking hygiene",
                          "Check for water contamination"
                        ]).map((tip: string, i: number) => (
                          <li key={i} className="text-sm flex items-start gap-3 text-foreground/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-dashed mt-auto">
                      <Info className="w-3.5 h-3.5" />
                      <span>These recommendations were automatically generated based on Nestlé quality verification results.</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default NestleRecommendations;
