const express = require('express');
const cors = require('cors');
require('dotenv').config();
const supabase = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmers');
const collectionRoutes = require('./routes/collections');
const qualityRoutes = require('./routes/quality');
const dispatchRoutes = require('./routes/dispatches');
const pricingRoutes = require('./routes/pricing');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/quality-tests', qualityRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/pricing-rules', pricingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// ---------- Test Supabase Connection ----------
app.get('/api/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase.from('chilling_centers').select('count', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected (Supabase SDK)', result: data });
  } catch (err) {
    console.error('Supabase test error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ---------- Chilling Centers (simple) ----------
app.get('/api/chilling-centers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('chilling_centers').select('id, name, location');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get chilling centers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Performance Stats (Dashboard) ----------
const { authenticate } = require('./middleware/auth');
app.get('/api/chilling-centers/performance', authenticate, async (req, res) => {
  try {
    // We get all centers first
    const { data: centers, error: cErr } = await supabase.from('chilling_centers').select('id, name');
    if (cErr) throw cErr;

    const result = [];

    for (const cc of centers) {
       // Get total quantity
       const { data: mc, error: mcErr } = await supabase
         .from('milk_collections')
         .select('quantity, quality_result')
         .eq('chilling_center_id', cc.id);
       
       if (mcErr) throw mcErr;

       const totalQuantity = mc.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
       const collectionCount = mc.length;
       const avgQuantity = collectionCount > 0 ? (totalQuantity / collectionCount) : 0;

       // Calculate quality rate
       const testedCount = mc.filter(item => item.quality_result !== null).length;
       const passedCount = mc.filter(item => item.quality_result === 'Pass').length;
       const qualityRate = testedCount > 0 ? parseFloat(((passedCount / testedCount) * 100).toFixed(1)) : 0;

       // Revenue estimate from payments (approximate join via SDK logic)
       // For large data, this should be a DB view or RPC.
       const { data: payments, error: pErr } = await supabase
         .from('payments')
         .select('amount, milk_collections!inner(chilling_center_id)')
         .eq('milk_collections.chilling_center_id', cc.id);
       
       if (pErr) throw pErr;
       const totalRevenue = payments.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

       result.push({
         centerId: cc.id,
         centerName: cc.name,
         totalQuantity,
         avgQuantity: Math.round(avgQuantity),
         collectionCount,
         qualityRate,
         totalRevenue,
         rank: 0 // Will set later
       });
    }

    result.sort((a, b) => b.totalQuantity - a.totalQuantity);
    result.forEach((item, index) => item.rank = index + 1);

    res.json(result);
  } catch (err) {
    console.error('Performance stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.send('Nestlé Dairy Supply Chain Backend (Supabase SDK) is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
