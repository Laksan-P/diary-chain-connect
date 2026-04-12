/**
 * Seed script — inserts demo data into Supabase using the SDK.
 * Run with: node seed.js
 */
const supabase = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('⏳ Connecting to Supabase via SDK...');

  try {
    const hash = await bcrypt.hash('password', 10);

    // ---- Users ----
    console.log('👤 Seeding users...');
    const users = [
      { id: 1, email: 'cc@nestle.com', password_hash: hash, name: 'Kandy Central CC', role: 'chilling_center' },
      { id: 2, email: 'nestle@nestle.com', password_hash: hash, name: 'Nestlé Officer', role: 'nestle' },
      { id: 10, email: 'anura@farmer.com', password_hash: hash, name: 'Anura Perera', role: 'farmer' },
      { id: 11, email: 'kumara@farmer.com', password_hash: hash, name: 'Kumara Silva', role: 'farmer' },
      { id: 12, email: 'nimal@farmer.com', password_hash: hash, name: 'Nimal Fernando', role: 'farmer' }
    ];
    await supabase.from('users').upsert(users);

    // ---- Nestle Officers ----
    console.log('👔 Seeding nestle officers...');
    const officers = [
      { id: 1, name: 'Nestlé Officer', designation: 'Senior Manager', user_id: 2 }
    ];
    await supabase.from('nestle_officers').upsert(officers);

    // ---- Chilling Centers ----
    console.log('🏭 Seeding chilling centers...');
    const centers = [
      { id: 1, name: 'Kandy Central CC', location: 'Kandy', user_id: 1 },
      { id: 2, name: 'Kurunegala CC', location: 'Kurunegala', user_id: null },
      { id: 3, name: 'Matale CC', location: 'Matale', user_id: null }
    ];
    await supabase.from('chilling_centers').upsert(centers);

    // ---- Farmers ----
    console.log('🧑‍🌾 Seeding farmers...');
    const farmers = [
      { id: 1, farmer_id: 'FRM-001', user_id: 10, name: 'Anura Perera', address: '123 Kandy Rd', phone: '0771234567', nic: '901234567V', chilling_center_id: 1 },
      { id: 2, farmer_id: 'FRM-002', user_id: 11, name: 'Kumara Silva', address: '456 Matale Rd', phone: '0779876543', nic: '881234567V', chilling_center_id: 1 },
      { id: 3, farmer_id: 'FRM-003', user_id: 12, name: 'Nimal Fernando', address: '789 Kurunegala', phone: '0765551234', nic: '951234567V', chilling_center_id: 2 }
    ];
    await supabase.from('farmers').upsert(farmers);

    // ---- Bank Accounts ----
    console.log('🏦 Seeding bank accounts...');
    const bankAccounts = [
      { id: 1, farmer_id: 1, bank_name: 'BOC', account_number: '1234567890', branch: 'Kandy' },
      { id: 2, farmer_id: 2, bank_name: 'Peoples Bank', account_number: '9876543210', branch: 'Matale' },
      { id: 3, farmer_id: 3, bank_name: 'Commercial Bank', account_number: '5555666677', branch: 'Kurunegala' }
    ];
    await supabase.from('bank_accounts').upsert(bankAccounts);

    // ---- Milk Collections ----
    console.log('🥛 Seeding milk collections...');
    const collections = [
      { id: 1, farmer_id: 1, chilling_center_id: 1, date: '2026-03-15', time: '06:30:00', temperature: 4.2, quantity: 120, milk_type: 'Cow', quality_result: 'Pass', failure_reason: null, dispatch_status: 'Approved' },
      { id: 2, farmer_id: 2, chilling_center_id: 1, date: '2026-03-15', time: '07:00:00', temperature: 4.5, quantity: 95, milk_type: 'Buffalo', quality_result: 'Fail', failure_reason: 'Low FAT', dispatch_status: 'Pending' },
      { id: 3, farmer_id: 1, chilling_center_id: 1, date: '2026-03-14', time: '06:45:00', temperature: 4.0, quantity: 130, milk_type: 'Cow', quality_result: 'Pass', failure_reason: null, dispatch_status: 'Dispatched' },
      { id: 4, farmer_id: 3, chilling_center_id: 2, date: '2026-03-15', time: '06:15:00', temperature: 3.8, quantity: 200, milk_type: 'Cow', quality_result: 'Pass', failure_reason: null, dispatch_status: 'Dispatched' },
      { id: 5, farmer_id: 1, chilling_center_id: 1, date: '2026-03-13', time: '06:30:00', temperature: 4.1, quantity: 110, milk_type: 'Goat', quality_result: 'Pass', failure_reason: null, dispatch_status: 'Approved' }
    ];
    await supabase.from('milk_collections').upsert(collections);

    // ---- Quality Tests ----
    console.log('🔬 Seeding quality tests...');
    const qualityTests = [
      { id: 1, collection_id: 1, fat: 4.2, snf: 8.8, water: 0.2, result: 'Pass', reason: null },
      { id: 2, collection_id: 2, fat: 3.0, snf: 8.5, water: 0.3, result: 'Fail', reason: 'Low FAT' },
      { id: 3, collection_id: 3, fat: 3.8, snf: 9.0, water: 0.1, result: 'Pass', reason: null },
      { id: 4, collection_id: 4, fat: 4.0, snf: 8.9, water: 0.2, result: 'Pass', reason: null },
      { id: 5, collection_id: 5, fat: 3.9, snf: 8.7, water: 0.3, result: 'Pass', reason: null }
    ];
    await supabase.from('quality_tests').upsert(qualityTests);

    // ---- Dispatches ----
    console.log('🚛 Seeding dispatches...');
    const dispatches = [
      { id: 1, chilling_center_id: 1, transporter_name: 'Lanka Transport', vehicle_number: 'WP-AB-1234', driver_contact: '0771112233', dispatch_date: '2026-03-14', status: 'Approved' },
      { id: 2, chilling_center_id: 2, transporter_name: 'Express Dairy', vehicle_number: 'NW-CD-5678', driver_contact: '0764445566', dispatch_date: '2026-03-15', status: 'Dispatched' }
    ];
    await supabase.from('dispatches').upsert(dispatches);

    // ---- Dispatch Items ----
    console.log('📦 Seeding dispatch items...');
    const dispatchItems = [
      { id: 1, dispatch_id: 1, collection_id: 3 },
      { id: 2, dispatch_id: 2, collection_id: 4 }
    ];
    await supabase.from('dispatch_items').upsert(dispatchItems);

    // ---- Pricing Rules ----
    console.log('💰 Seeding pricing rules...');
    const pricingRules = [
      { id: 1, base_price_per_liter: 85, fat_bonus: 2.5, snf_bonus: 1.8, effective_from: '2026-01-01', is_active: true },
      { id: 2, base_price_per_liter: 80, fat_bonus: 2.0, snf_bonus: 1.5, effective_from: '2025-07-01', is_active: false }
    ];
    await supabase.from('pricing_rules').upsert(pricingRules);

    // ---- Payments ----
    console.log('💵 Seeding payments...');
    const payments = [
      { id: 1, farmer_id: 1, collection_id: 1, quantity: 120, base_pay: 10200, fat_bonus: 300, snf_bonus: 150, amount: 10650, status: 'Paid', paid_at: '2026-03-16 10:00:00' },
      { id: 2, farmer_id: 1, collection_id: 5, quantity: 110, base_pay: 9350, fat_bonus: 275, snf_bonus: 110, amount: 9735, status: 'Pending', paid_at: null }
    ];
    await supabase.from('payments').upsert(payments);

    // ---- Notifications ----
    console.log('🔔 Seeding notifications...');
    const notifications = [
      { id: 1, user_id: 10, title: 'Quality Test Passed', message: 'Your milk collection on 2026-03-15 passed quality testing.', type: 'quality_result', is_read: false },
      { id: 2, user_id: 10, title: 'Payment Completed', message: 'Payment of Rs. 10,650 has been credited.', type: 'payment', is_read: true }
    ];
    await supabase.from('notifications').upsert(notifications);

    console.log('✅ Seed complete!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  }
}

seed().catch(err => {
  console.error('❌ Fatal error during seed:', err);
  process.exit(1);
});
