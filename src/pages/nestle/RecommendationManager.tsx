import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Info,
  BookOpen,
  Languages,
  ChevronLeft
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getRecommendations, saveRecommendation, deleteRecommendation } from '@/services/api';
import { PerformanceRecommendation } from '@/types';

const RecommendationManager = () => {
  const [recommendations, setRecommendations] = useState<PerformanceRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const initialFormState = {
    issue_type: 'SNF',
    title_en: '',
    title_si: '',
    title_ta: '',
    description_en: '',
    description_si: '',
    description_ta: '',
    guidance_en: [] as string[],
    guidance_si: [] as string[],
    guidance_ta: [] as string[],
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  };

  const [form, setForm] = useState(initialFormState);
  const [guidanceInput, setGuidanceInput] = useState({ en: '', si: '', ta: '' });

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const data = await getRecommendations();
      setRecommendations(data);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch recommendations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = isEditing ? { ...form, id: isEditing } : form;
      await saveRecommendation(payload);

      toast({
        title: 'Success',
        description: `Recommendation ${isEditing ? 'updated' : 'created'} successfully`
      });

      setIsAdding(false);
      setIsEditing(null);
      setForm(initialFormState);
      fetchRecommendations();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save recommendation', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recommendation?')) return;
    try {
      await deleteRecommendation(id);
      toast({ title: 'Success', description: 'Recommendation deleted' });
      fetchRecommendations();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete recommendation', variant: 'destructive' });
    }
  };

  const startEdit = (rec: PerformanceRecommendation) => {
    setIsEditing(rec.id);
    setForm({
      issue_type: rec.issue_type,
      title_en: rec.title_en,
      title_si: rec.title_si || '',
      title_ta: rec.title_ta || '',
      description_en: rec.description_en || '',
      description_si: rec.description_si || '',
      description_ta: rec.description_ta || '',
      guidance_en: rec.guidance_en || [],
      guidance_si: rec.guidance_si || [],
      guidance_ta: rec.guidance_ta || [],
      severity: rec.severity
    });
  };

  const addGuidanceItem = (lang: 'en' | 'si' | 'ta') => {
    const input = guidanceInput[lang].trim();
    if (!input) return;

    setForm(prev => ({
      ...prev,
      [`guidance_${lang}`]: [...(prev[`guidance_${lang}` as keyof typeof form] as string[] || []), input]
    }));
    setGuidanceInput(prev => ({ ...prev, [lang]: '' }));
  };

  const removeGuidanceItem = (lang: 'en' | 'si' | 'ta', index: number) => {
    setForm(prev => ({
      ...prev,
      [`guidance_${lang}`]: (prev[`guidance_${lang}` as keyof typeof form] as string[]).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {(isAdding || isEditing) && (
        <Button
          variant="ghost"
          onClick={() => { setIsAdding(false); setIsEditing(null); }}
          className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Recommendations
        </Button>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Recommendation Manager</h1>
          <p className="text-muted-foreground">Manage performance improvement guidance for farmers.</p>
        </div>
        {!isAdding && !isEditing && (
          <Button onClick={() => setIsAdding(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> New Recommendation
          </Button>
        )}
      </div>

      {(isAdding || isEditing) && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Recommendation' : 'New Recommendation'}</CardTitle>
            <CardDescription>Configure guidance for a specific issue type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Type</Label>
                <Input value={form.issue_type} onChange={e => setForm({ ...form, issue_type: e.target.value })} placeholder="e.g. SNF, FAT, WATER" />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={form.severity}
                  onChange={e => setForm({ ...form, severity: e.target.value as any })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              {/* English Section */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Languages className="w-4 h-4" /> English
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Guidance Items</Label>
                  <div className="flex gap-2">
                    <Input value={guidanceInput.en} onChange={e => setGuidanceInput({ ...guidanceInput, en: e.target.value })} placeholder="Add a step..." />
                    <Button type="button" variant="secondary" onClick={() => addGuidanceItem('en')}>Add</Button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {form.guidance_en.map((item, i) => (
                      <li key={i} className="flex justify-between items-center text-sm p-2 bg-background border rounded">
                        {item}
                        <Button variant="ghost" size="sm" onClick={() => removeGuidanceItem('en', i)}><X className="w-3 h-3" /></Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sinhala Section */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-amber-600 font-semibold">
                  <Languages className="w-4 h-4" /> Sinhala (සිංහල)
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title_si} onChange={e => setForm({ ...form, title_si: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description_si} onChange={e => setForm({ ...form, description_si: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Guidance Items</Label>
                  <div className="flex gap-2">
                    <Input value={guidanceInput.si} onChange={e => setGuidanceInput({ ...guidanceInput, si: e.target.value })} placeholder="Add a step..." />
                    <Button type="button" variant="secondary" onClick={() => addGuidanceItem('si')}>Add</Button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {form.guidance_si.map((item, i) => (
                      <li key={i} className="flex justify-between items-center text-sm p-2 bg-background border rounded">
                        {item}
                        <Button variant="ghost" size="sm" onClick={() => removeGuidanceItem('si', i)}><X className="w-3 h-3" /></Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tamil Section */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                  <Languages className="w-4 h-4" /> Tamil (தமிழ்)
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title_ta} onChange={e => setForm({ ...form, title_ta: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description_ta} onChange={e => setForm({ ...form, description_ta: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Guidance Items</Label>
                  <div className="flex gap-2">
                    <Input value={guidanceInput.ta} onChange={e => setGuidanceInput({ ...guidanceInput, ta: e.target.value })} placeholder="Add a step..." />
                    <Button type="button" variant="secondary" onClick={() => addGuidanceItem('ta')}>Add</Button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {form.guidance_ta.map((item, i) => (
                      <li key={i} className="flex justify-between items-center text-sm p-2 bg-background border rounded">
                        {item}
                        <Button variant="ghost" size="sm" onClick={() => removeGuidanceItem('ta', i)}><X className="w-3 h-3" /></Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(null); }}>Cancel</Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90"><Save className="w-4 h-4 mr-2" /> Save Recommendation</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map(rec => (
          <Card key={rec.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <Badge variant={rec.severity === 'HIGH' ? 'destructive' : rec.severity === 'MEDIUM' ? 'secondary' : 'default'}>
                  {rec.severity}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(rec)}><Edit2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(rec.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <CardTitle className="text-xl mt-2">{rec.title_en}</CardTitle>
              <CardDescription>{rec.issue_type} Issues</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{rec.description_en}</p>
              <div className="flex gap-4 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {rec.guidance_en?.length || 0} English steps</span>
                <span className="flex items-center gap-1"><Languages className="w-3 h-3" /> SI/TA translations ready</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RecommendationManager;
