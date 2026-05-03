import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Phone, Save, RefreshCw, MessageSquare, Reply } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const SupportManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<any>(null);

  const [faqForm, setFaqForm] = useState({
    question: '', answer: '',
    question_si: '', answer_si: '',
    question_ta: '', answer_ta: '',
    role: 'farmer'
  });
  const [nestlePhone, setNestlePhone] = useState('');
  const [nestleName, setNestleName] = useState('Nestlé HQ Support');
  const [logSearch, setLogSearch] = useState('');
  const [logRoleFilter, setLogRoleFilter] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);

  // Fetch configs
  const { data: phoneConfig } = useQuery({
    queryKey: ['system_config', 'nestle_phone'],
    queryFn: () => apiFetch<any>('/api/config?key=nestle_phone')
  });

  const { data: nameConfig } = useQuery({
    queryKey: ['system_config', 'nestle_name'],
    queryFn: () => apiFetch<any>('/api/config?key=nestle_name')
  });

  useEffect(() => {
    if (phoneConfig?.config_value) setNestlePhone(phoneConfig.config_value);
    if (nameConfig?.config_value) setNestleName(nameConfig.config_value);
  }, [phoneConfig, nameConfig]);

  // Fetch FAQs
  const { data: faqs = [] } = useQuery({
    queryKey: ['faqs'],
    queryFn: () => apiFetch<any[]>('/api/faq')
  });

  // Fetch Feedback Logs
  const { data: feedbackLogs = [] } = useQuery({
    queryKey: ['feedback_logs'],
    queryFn: () => apiFetch<any[]>('/api/feedback-logs')
  });

  // Fetch Support Tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ['support_tickets'],
    queryFn: () => apiFetch<any[]>('/api/support')
  });

  const saveConfigMutation = useMutation({
    mutationFn: ({ key, value }: { key: string, value: string }) =>
      apiFetch<any>('/api/config', {
        method: 'POST',
        body: JSON.stringify({ key, value })
      }),
    onSuccess: (_, variables) => {
      toast.success(`${variables.key === 'nestle_name' ? 'Support name' : 'Phone number'} updated`);
      queryClient.invalidateQueries({ queryKey: ['system_config'] });
    },
    onError: () => toast.error('Failed to update configuration')
  });

  const saveFaqMutation = useMutation({
    mutationFn: (data: any) => apiFetch<any>('/api/faq', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('FAQ saved successfully');
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
      setIsFaqOpen(false);
      setEditingFaq(null);
      setFaqForm({
        question: '', answer: '',
        question_si: '', answer_si: '',
        question_ta: '', answer_ta: '',
        role: 'farmer'
      });
    },
    onError: () => toast.error('Failed to save FAQ')
  });

  const deleteFaqMutation = useMutation({
    mutationFn: (id: number) => apiFetch<any>(`/api/faq?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('FAQ deleted');
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
    },
    onError: () => toast.error('Failed to delete FAQ')
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: number, reply: string }) => 
      apiFetch<any>(`/api/support?id=${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ reply }) 
      }),
    onSuccess: () => {
      toast.success('Reply sent successfully');
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      setIsReplyOpen(false);
      setReplyText('');
      setSelectedTicket(null);
    },
    onError: () => toast.error('Failed to send reply')
  });

  const handleSaveFaq = () => {
    if (!faqForm.question || !faqForm.answer) {
      toast.error('Question and answer are required');
      return;
    }
    saveFaqMutation.mutate({ ...faqForm, id: editingFaq?.id });
  };

  const openEditFaq = (faq: any) => {
    setEditingFaq(faq);
    setFaqForm({
      question: faq.question, answer: faq.answer,
      question_si: faq.question_si || '', answer_si: faq.answer_si || '',
      question_ta: faq.question_ta || '', answer_ta: faq.answer_ta || '',
      role: faq.role
    });
    setIsFaqOpen(true);
  };

  const filteredLogs = feedbackLogs.filter((log: any) => {
    const matchesSearch =
      (log.user_id?.toString() || '').toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.additional_info || '').toLowerCase().includes(logSearch.toLowerCase());
    const matchesRole = logRoleFilter === 'all' || log.role === logRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Support & FAQ</h2>
          <p className="text-muted-foreground">Manage FAQs, contact numbers, and view farmer feedback.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries()}
          className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-none"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Nestlé Support Number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label>Support Display Name</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Nestlé HQ Support"
                      value={nestleName}
                      onChange={e => setNestleName(e.target.value)}
                    />
                    <Button
                      onClick={() => saveConfigMutation.mutate({ key: 'nestle_name', value: nestleName })}
                      disabled={saveConfigMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Support Phone Number</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="+94 77..."
                      value={nestlePhone}
                      onChange={e => setNestlePhone(e.target.value)}
                    />
                    <Button
                      onClick={() => saveConfigMutation.mutate({ key: 'nestle_phone', value: nestlePhone })}
                      disabled={saveConfigMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                These details are displayed in the Farmer and Chilling Center apps for "Other Issues".
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg">FAQ Management</CardTitle>
            <Dialog open={isFaqOpen} onOpenChange={setIsFaqOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => {
                  setEditingFaq(null);
                  setFaqForm({
                    question: '', answer: '',
                    question_si: '', answer_si: '',
                    question_ta: '', answer_ta: '',
                    role: 'farmer'
                  });
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 space-y-6 py-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={faqForm.role} onValueChange={v => setFaqForm({ ...faqForm, role: v })}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="farmer">Farmer</SelectItem>
                        <SelectItem value="chilling_center">Chilling Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-primary">English (Default)</h4>
                    <div className="space-y-2">
                      <Label>Question (EN)</Label>
                      <Input value={faqForm.question} onChange={e => setFaqForm({ ...faqForm, question: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer (EN)</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={faqForm.answer}
                        onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-primary">Sinhala Translation</h4>
                    <div className="space-y-2">
                      <Label>Question (SI)</Label>
                      <Input value={faqForm.question_si} onChange={e => setFaqForm({ ...faqForm, question_si: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer (SI)</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={faqForm.answer_si}
                        onChange={e => setFaqForm({ ...faqForm, answer_si: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-primary">Tamil Translation</h4>
                    <div className="space-y-2">
                      <Label>Question (TA)</Label>
                      <Input value={faqForm.question_ta} onChange={e => setFaqForm({ ...faqForm, question_ta: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer (TA)</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={faqForm.answer_ta}
                        onChange={e => setFaqForm({ ...faqForm, answer_ta: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="p-6 pt-2 border-t">
                  <Button variant="outline" onClick={() => setIsFaqOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveFaq} disabled={saveFaqMutation.isPending}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {faqs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No FAQs found.</p>
            ) : (
              <div className="space-y-4">
                {faqs.map((faq: any) => (
                  <div key={faq.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                          {faq.role}
                        </span>
                        <h4 className="font-medium text-sm">{faq.question}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditFaq(faq)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteFaqMutation.mutate(faq.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Custom Support Issues
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
              {tickets.filter((t: any) => t.status === 'pending').length} Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No custom issues reported.</p>
            ) : (
              tickets.map((ticket: any) => (
                <div key={ticket.id} className="p-4 border rounded-xl bg-card hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {ticket.users?.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{ticket.users?.name || 'Unknown User'}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize px-1.5 py-0.5 rounded bg-muted font-medium">
                            {ticket.role.replace('_', ' ')}
                          </span>
                          <span>•</span>
                          <span>{new Date(ticket.created_at).toLocaleString()}</span>
                          <span>•</span>
                          <span className="uppercase text-[10px] font-bold border px-1 rounded">
                            {ticket.language}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={ticket.status === 'replied' ? 'secondary' : 'destructive'} className="rounded-full">
                      {ticket.status === 'replied' ? 'Replied' : 'Pending'}
                    </Badge>
                  </div>
                  
                  <div className="pl-13 ml-13 border-l-2 border-primary/20 pl-4 py-1">
                    <p className="text-sm leading-relaxed">{ticket.message}</p>
                  </div>

                  {ticket.reply ? (
                    <div className="mt-4 pl-13 ml-13 border-l-2 border-emerald-500/20 pl-4 py-2 bg-emerald-50/30 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Reply className="w-3 h-3 text-emerald-600" />
                        <span className="text-[10px] font-bold uppercase text-emerald-600">Nestlé Reply</span>
                        <span className="text-[10px] text-muted-foreground italic">
                          at {new Date(ticket.replied_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{ticket.reply}</p>
                    </div>
                  ) : (
                    <div className="mt-4 pl-13 ml-13 flex justify-end">
                      <Dialog open={isReplyOpen && selectedTicket?.id === ticket.id} onOpenChange={(open) => {
                        setIsReplyOpen(open);
                        if (!open) setSelectedTicket(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            <Reply className="w-4 h-4" />
                            Reply to {ticket.role === 'farmer' ? 'Farmer' : 'CC'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reply to Support Issue</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="p-3 bg-muted/50 rounded-lg text-sm italic">
                              "{ticket.message}"
                            </div>
                            <div className="space-y-2">
                              <Label>Your Answer</Label>
                              <textarea 
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                placeholder="Type your reply here..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsReplyOpen(false)}>Cancel</Button>
                            <Button 
                              onClick={() => replyMutation.mutate({ id: ticket.id, reply: replyText })}
                              disabled={replyMutation.isPending || !replyText.trim()}
                            >
                              Send Reply
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-lg">Feedback Logs</CardTitle>
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search User ID or Action..."
              className="max-w-[250px]"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
            />
            <Select value={logRoleFilter} onValueChange={setLogRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="farmer">Farmers</SelectItem>
                <SelectItem value="chilling_center">Chilling Centers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Time</th>
                  <th className="h-10 px-4 text-left font-medium">Role</th>
                  <th className="h-10 px-4 text-left font-medium">User ID</th>
                  <th className="h-10 px-4 text-left font-medium">Action / Question</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">No logs found</td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any) => (
                    <tr key={log.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
                      <td className="p-4 capitalize">{log.role ? log.role.replace('_', ' ') : 'Unknown'}</td>
                      <td className="p-4 font-mono text-xs">{log.user_id ?? 'System'}</td>
                      <td className="p-4">
                        {log.question_id ? (
                          <span><span className="text-muted-foreground">Viewed FAQ:</span> {log.faq?.question || `ID ${log.question_id}`}</span>
                        ) : (
                          <span className="font-medium text-primary">{log.additional_info || 'Other Issue'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportManagement;
