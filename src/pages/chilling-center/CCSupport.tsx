import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, ChevronDown, ChevronUp, MessageSquare, Reply, Edit2, Send, Plus, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function CCSupport() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySi, setReplySi] = useState('');
  const [replyTa, setReplyTa] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTicketMsg, setNewTicketMsg] = useState('');

  // Fetch configs
  const { data: configData } = useQuery({
    queryKey: ['system_config', 'nestle_phone'],
    queryFn: () => apiFetch<any>('/api/config?key=nestle_phone')
  });

  const { data: nameConfig } = useQuery({
    queryKey: ['system_config', 'nestle_name'],
    queryFn: () => apiFetch<any>('/api/config?key=nestle_name')
  });

  const nestlePhone = configData?.config_value;
  const nestleName = nameConfig?.config_value || 'Nestlé Support';

  // Fetch FAQs
  const { data: faqs = [] } = useQuery({
    queryKey: ['faqs', 'chilling_center'],
    queryFn: () => apiFetch<any[]>('/api/faq?role=chilling_center')
  });

  // Fetch Tickets (Farmer issues assigned to this CC + CC's own tickets)
  const { data: tickets = [], isLoading: ticketsLoading, isFetching } = useQuery({
    queryKey: ['support_tickets'],
    queryFn: () => apiFetch<any[]>('/api/support'),
    refetchInterval: 30000 // Refresh every 30s
  });

  const logFeedbackMutation = useMutation({
    mutationFn: (data: any) => apiFetch<any>('/api/feedback-logs', { method: 'POST', body: JSON.stringify(data) })
  });

  const createTicketMutation = useMutation({
    mutationFn: (message: string) => apiFetch<any>('/api/support', { 
      method: 'POST', 
      body: JSON.stringify({ message, language: 'en' }) 
    }),
    onSuccess: () => {
      toast.success('Your message has been sent to Nestlé');
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      setIsNewTicketOpen(false);
      setNewTicketMsg('');
    },
    onError: () => toast.error('Failed to send message')
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply, reply_si, reply_ta }: { id: number, reply: string, reply_si: string, reply_ta: string }) => 
      apiFetch<any>(`/api/support?id=${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ reply, reply_si, reply_ta }) 
      }),
    onSuccess: () => {
      toast.success('Reply updated successfully');
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      setIsReplyOpen(false);
      setReplyText('');
      setReplySi('');
      setReplyTa('');
      setSelectedTicket(null);
    },
    onError: () => toast.error('Failed to save reply')
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

  const openReply = async (ticket: any) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.reply || '');
    setReplySi(ticket.reply_si || '');
    setReplyTa(ticket.reply_ta || '');
    setIsReplyOpen(true);

    // Mark as read in background if unread
    if (!ticket.is_read_by_admin) {
      apiFetch(`/api/support?id=${ticket.id}&markRead=true`).then(() => {
        queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">FAQ & Support</h2>
          <p className="text-muted-foreground">Manage farmer issues and get help from Nestlé HQ.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> New Ticket to Nestlé
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contact Nestlé HQ</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Describe your issue or question</Label>
                  <textarea 
                    className="w-full min-h-[120px] p-3 rounded-md border bg-background text-sm"
                    placeholder="Type your message to Nestlé here..."
                    value={newTicketMsg}
                    onChange={(e) => setNewTicketMsg(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => createTicketMutation.mutate(newTicketMsg)}
                  disabled={createTicketMutation.isPending || !newTicketMsg.trim()}
                >
                  <Send className="w-4 h-4 mr-2" /> Send to Nestlé
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['support_tickets'] })}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="farmer-issues" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="farmer-issues" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Farmer Issues
          </TabsTrigger>
          <TabsTrigger value="my-tickets" className="gap-2">
            <Send className="w-4 h-4" /> My Tickets
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2">
            <Plus className="w-4 h-4" /> Help & FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="farmer-issues">
          <Card>
            <CardHeader>
              <CardTitle>Issues from your Farmers</CardTitle>
              <CardDescription>Review and reply to custom questions submitted by farmers in your center.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticketsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading tickets...</div>
                ) : (
                  tickets.filter((t: any) => t.role === 'farmer').length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground italic border-2 border-dashed rounded-lg">
                      No farmer issues found.
                    </div>
                  ) : (
                    tickets.filter((t: any) => t.role === 'farmer').map((ticket: any) => (
                      <div key={ticket.id} className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-primary">{ticket.users?.name || 'Unknown Farmer'}</span>
                              <Badge variant={ticket.status === 'replied' ? 'secondary' : 'destructive'}>
                                {ticket.status === 'replied' ? 'Replied' : 'Pending'}
                                {!ticket.is_read_by_admin && <div className="ml-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                              </Badge>
                            </div>
                            <p className="text-sm italic">"{ticket.message}"</p>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {new Date(ticket.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <Button 
                            variant={ticket.status === 'replied' ? 'outline' : 'default'}
                            size="sm"
                            className="gap-2"
                            onClick={() => openReply(ticket)}
                          >
                            {ticket.status === 'replied' ? <Edit2 className="w-4 h-4" /> : <Reply className="w-4 h-4" />}
                            {ticket.status === 'replied' ? 'Edit Reply' : 'Reply'}
                          </Button>
                        </div>
                        
                        {ticket.reply && (
                          <div className="mt-3 p-3 bg-background rounded border-l-4 border-primary">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] font-bold">Your Response</Badge>
                            </div>
                            <p className="text-sm">{ticket.reply}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-tickets">
          <Card>
            <CardHeader>
              <CardTitle>Your Support Tickets</CardTitle>
              <CardDescription>View status of issues you sent to Nestlé HQ.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tickets.filter((t: any) => t.role === 'chilling_center').length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground italic border-2 border-dashed rounded-lg">
                    You haven't submitted any tickets to Nestlé.
                  </div>
                ) : (
                  tickets.filter((t: any) => t.role === 'chilling_center').map((ticket: any) => (
                    <div key={ticket.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={ticket.status === 'replied' ? 'secondary' : 'outline'}>
                          {ticket.status === 'replied' ? 'Answered' : 'Waiting for Nestlé'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-medium text-sm mb-2">{ticket.message}</p>
                      {ticket.reply && (
                        <div className="mt-3 p-3 bg-primary/5 rounded border-l-4 border-primary">
                          <p className="text-xs font-bold text-primary mb-1">{nestleName} Reply:</p>
                          <p className="text-sm">{ticket.reply}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <div className="space-y-4">
            {faqs.length === 0 ? (
              <p className="text-muted-foreground p-4 bg-muted/20 rounded-lg border text-center">No FAQs available.</p>
            ) : (
              faqs.map((faq: any) => {
                const isExpanded = expandedId === faq.id;
                return (
                  <Card key={faq.id} className="cursor-pointer" onClick={() => handleToggle(faq.id)}>
                    <div className="p-4 flex items-center justify-between">
                      <h3 className="font-medium">{faq.question}</h3>
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
            
            <Card className="bg-primary/5 border-primary/20 mt-8">
              <CardHeader>
                <CardTitle className="text-xl text-primary">Need Immediate Help?</CardTitle>
                <p className="text-sm text-muted-foreground">Contact Nestlé HQ directly via phone for urgent matters.</p>
              </CardHeader>
              <CardContent>
                {nestlePhone ? (
                  <Button onClick={handleCallNestle} size="lg" className="gap-2">
                    <Phone className="w-5 h-5" /> Call Nestlé ({nestlePhone})
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Phone contact not configured.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={(open) => {
        setIsReplyOpen(open);
        if (!open) setSelectedTicket(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.reply ? 'Edit Response' : 'Reply to Farmer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg text-sm italic">
              "{selectedTicket?.message}"
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">English Reply</Label>
              <textarea 
                className="w-full min-h-[80px] p-2 rounded-md border bg-background text-sm"
                placeholder="Type English reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">Sinhala Reply (සිංහල)</Label>
              <textarea 
                className="w-full min-h-[80px] p-2 rounded-md border bg-background text-sm"
                placeholder="Type Sinhala reply..."
                value={replySi}
                onChange={(e) => setReplySi(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">Tamil Reply (தமிழ்)</Label>
              <textarea 
                className="w-full min-h-[80px] p-2 rounded-md border bg-background text-sm"
                placeholder="Type Tamil reply..."
                value={replyTa}
                onChange={(e) => setReplyTa(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => replyMutation.mutate({ 
                id: selectedTicket.id, 
                reply: replyText,
                reply_si: replySi,
                reply_ta: replyTa
              })}
              disabled={replyMutation.isPending || (!replyText.trim() && !replySi.trim() && !replyTa.trim())}
            >
              {selectedTicket?.reply ? 'Update Reply' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
