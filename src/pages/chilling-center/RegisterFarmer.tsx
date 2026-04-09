import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getChillingCenters, registerFarmerByCenter } from '@/services/api';
import type { ChillingCenter } from '@/types';


const RegisterFarmer: React.FC = () => {
  const [centers, setCenters] = useState<ChillingCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '', address: '', phone: '', nic: '', chillingCenterId: '',
    bankName: '', accountNumber: '', branch: '', email: '', password: '',
  });

  const { user } = useAuth();

  useEffect(() => { 
    getChillingCenters().then(centersList => {
      setCenters(centersList);
      if (user?.chillingCenterId) {
        update('chillingCenterId', String(user.chillingCenterId));
      }
    }); 
  }, [user]);

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const farmer = await registerFarmerByCenter({ ...form, chillingCenterId: parseInt(form.chillingCenterId) });
      toast({ title: 'Farmer Registered', description: `Farmer ID: ${farmer.farmerId}` });
      setForm({ name: '', address: '', phone: '', nic: '', chillingCenterId: '', bankName: '', accountNumber: '', branch: '', email: '', password: '' });
    } catch {
      toast({ title: 'Error', description: 'Failed to register farmer', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Register New Farmer</h2>
          <p className="text-sm text-muted-foreground">Add a farmer to the chilling center</p>
        </div>
      </div>

      <motion.form onSubmit={handleSubmit} className="glass-card p-6 space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Sunil Perera" required /></div>
          <div className="space-y-2">
            <Label>NIC</Label>
            <Input 
              value={form.nic} 
              onChange={e => update('nic', e.target.value.toUpperCase())} 
              maxLength={12} 
              placeholder="e.g. 199012345678" 
              required 
            />
          </div>
          <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="e.g. No 24, Flower Road, Colombo" required /></div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input 
              value={form.phone} 
              onChange={e => update('phone', e.target.value.replace(/\D/g, ''))} 
              maxLength={10} 
              placeholder="e.g. 0771234567" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label>Chilling Center</Label>
            <Select value={form.chillingCenterId} onValueChange={v => update('chillingCenterId', v)}>
              <SelectTrigger><SelectValue placeholder="Select center" /></SelectTrigger>
              <SelectContent>{centers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-display font-semibold text-foreground mb-3">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bankName} onChange={e => update('bankName', e.target.value)} placeholder="e.g. Bank of Ceylon" required /></div>
            <div className="space-y-2"><Label>Account Number</Label><Input value={form.accountNumber} onChange={e => update('accountNumber', e.target.value)} placeholder="e.g. 1234567890" required /></div>
            <div className="space-y-2"><Label>Branch</Label><Input value={form.branch} onChange={e => update('branch', e.target.value)} placeholder="e.g. Kandy" required /></div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-display font-semibold text-foreground mb-3">Login Credentials</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="e.g. sunil@example.com" required /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => update('password', e.target.value)} required /></div>
          </div>
        </div>

        <Button type="submit" className="w-full btn-press" disabled={loading}>
          {loading ? 'Registering...' : 'Register Farmer'}
        </Button>
      </motion.form>
    </div>
  );
};

export default RegisterFarmer;
