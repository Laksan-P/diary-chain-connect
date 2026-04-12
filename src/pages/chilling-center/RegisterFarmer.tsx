import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getChillingCenters, registerFarmerByCenter } from '@/services/api';
import type { ChillingCenter } from '@/types';


const SRI_LANKAN_BANKS = [
  { name: 'Bank of Ceylon', length: 12 },
  { name: 'People\'s Bank', length: 15 },
  { name: 'Commercial Bank', length: 10 },
  { name: 'Hatton National Bank', length: 12 },
  { name: 'Sampath Bank', length: 12 },
  { name: 'Seylan Bank', length: 15 },
  { name: 'Nations Trust Bank', length: 15 },
  { name: 'DFCC Bank', length: 12 },
  { name: 'NDB Bank', length: 12 },
  { name: 'Pan Asia Bank', length: 12 },
  { name: 'Union Bank', length: 12 },
  { name: 'Amana Bank', length: 12 },
  { name: 'Cargills Bank', length: 12 },
];

const RegisterFarmer: React.FC = () => {
  const [centers, setCenters] = useState<ChillingCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
          {!user?.chillingCenterId && (
            <div className="space-y-2">
              <Label>Chilling Center</Label>
              <Select value={form.chillingCenterId} onValueChange={v => update('chillingCenterId', v)}>
                <SelectTrigger><SelectValue placeholder="Select center" /></SelectTrigger>
                <SelectContent>{centers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="font-display font-semibold text-foreground mb-3">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Select 
                value={form.bankName} 
                onValueChange={v => {
                  update('bankName', v);
                  // Clear account number if bank changes to avoid invalid data
                  update('accountNumber', '');
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>
                  {SRI_LANKAN_BANKS.map(b => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input 
                value={form.accountNumber} 
                onChange={e => update('accountNumber', e.target.value.replace(/\D/g, ''))} 
                placeholder={form.bankName ? `e.g. ${'1'.repeat(SRI_LANKAN_BANKS.find(b => b.name === form.bankName)?.length || 10)}` : "e.g. 1234567890"}
                maxLength={SRI_LANKAN_BANKS.find(b => b.name === form.bankName)?.length || 20}
                required 
              />
              {form.bankName && form.bankName !== 'Other' && (
                <p className="text-[10px] text-muted-foreground">Required length: {SRI_LANKAN_BANKS.find(b => b.name === form.bankName)?.length} digits</p>
              )}
            </div>
            <div className="space-y-2"><Label>Branch</Label><Input value={form.branch} onChange={e => update('branch', e.target.value)} placeholder="e.g. Kandy" required /></div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-display font-semibold text-foreground mb-3">Login Credentials</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="e.g. sunil@example.com" required /></div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  value={form.password} 
                  onChange={e => update('password', e.target.value)} 
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
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
