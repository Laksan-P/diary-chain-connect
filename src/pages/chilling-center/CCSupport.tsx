import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CCSupport() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch configs
  const { data: configData } = useQuery({
    queryKey: ['system_config', 'nestle_phone'],
    queryFn: () => apiFetch<any>('/api/config?key=nestle_phone')
  });

  const nestlePhone = configData?.config_value;

  // Fetch FAQs
  const { data: faqs = [] } = useQuery({
    queryKey: ['faqs', 'chilling_center'],
    queryFn: () => apiFetch<any[]>('/api/faq?role=chilling_center')
  });

  const logFeedbackMutation = useMutation({
    mutationFn: (data: any) => apiFetch<any>('/api/feedback-logs', { method: 'POST', body: JSON.stringify(data) })
  });

  const handleToggle = (id: number) => {
    const isExpanded = expandedId === id;
    setExpandedId(isExpanded ? null : id);
    if (!isExpanded) {
      logFeedbackMutation.mutate({ question_id: id });
    }
  };

  const handleCallNestle = () => {
    logFeedbackMutation.mutate({ additional_info: 'Called: Call Nestlé' });
    if (nestlePhone) {
      window.location.href = `tel:${nestlePhone}`;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">FAQ & Support</h2>
        <p className="text-muted-foreground">Find answers to common questions or contact Nestlé support.</p>
      </div>

      <div className="space-y-4">
        {faqs.length === 0 ? (
          <p className="text-muted-foreground p-4 bg-muted/20 rounded-lg border text-center">No FAQs available at the moment.</p>
        ) : (
          faqs.map((faq: any) => {
            const isExpanded = expandedId === faq.id;
            return (
              <Card key={faq.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => handleToggle(faq.id)}>
                <div className="p-4 flex items-center justify-between">
                  <h3 className="font-medium text-base">{faq.question}</h3>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Other Issue?</CardTitle>
          <p className="text-sm text-muted-foreground">Can't find what you're looking for? Contact support.</p>
        </CardHeader>
        <CardContent>
          {nestlePhone ? (
            <Button onClick={handleCallNestle} size="lg" className="w-full sm:w-auto flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Call Nestlé
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nestlé support contact number is currently not configured.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
