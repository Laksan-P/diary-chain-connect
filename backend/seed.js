/**
 * Seed script — creates the database, tables, and inserts demo data.
 * Run with: node seed.js
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function seed() {
  // Connect without database to create it
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  console.log('⏳ Creating database and tables...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await rootConn.query(schema);
  await rootConn.end();

  // Now connect to the database
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const hash = await bcrypt.hash('password', 10);

  // ---- Users ----
  console.log('👤 Seeding users...');
  await conn.query(`INSERT IGNORE INTO users (id, email, password_hash, name, role) VALUES
    (1, 'cc@nestle.com', ?, 'CC Staff', 'chilling_center'),
    (2, 'nestle@nestle.com', ?, 'Nestlé Officer', 'nestle'),
    (10, 'anura@farmer.com', ?, 'Anura Perera', 'farmer'),
    (11, 'kumara@farmer.com', ?, 'Kumara Silva', 'farmer'),
    (12, 'nimal@farmer.com', ?, 'Nimal Fernando', 'farmer')
  `, [hash, hash, hash, hash, hash]);

  // ---- Nestle Officers ----
  console.log('👔 Seeding nestle officers...');
  await conn.query(`INSERT IGNORE INTO nestle_officers (id, name, designation, user_id) VALUES
    (1, 'Nestlé Officer', 'Senior Manager', 2)
  `);

  // ---- Chilling Centers ----
  console.log('🏭 Seeding chilling centers...');
  await conn.query(`INSERT IGNORE INTO chilling_centers (id, name, location, user_id) VALUES
    (1, 'Kandy Central CC', 'Kandy', 1),
    (2, 'Kurunegala CC', 'Kurunegala', NULL),
    (3, 'Matale CC', 'Matale', NULL)
  `);

  // ---- Farmers ----
  console.log('🧑‍🌾 Seeding farmers...');
  await conn.query(`INSERT IGNORE INTO farmers (id, farmer_id, user_id, name, address, phone, nic, chilling_center_id) VALUES
    (1, 'FRM-001', 10, 'Anura Perera', '123 Kandy Rd', '0771234567', '901234567V', 1),
    (2, 'FRM-002', 11, 'Kumara Silva', '456 Matale Rd', '0779876543', '881234567V', 1),
    (3, 'FRM-003', 12, 'Nimal Fernando', '789 Kurunegala', '0765551234', '951234567V', 2)
  `);

  // ---- Bank Accounts ----
  console.log('🏦 Seeding bank accounts...');
  await conn.query(`INSERT IGNORE INTO bank_accounts (id, farmer_id, bank_name, account_number, branch) VALUES
    (1, 1, 'BOC', '1234567890', 'Kandy'),
    (2, 2, 'Peoples Bank', '9876543210', 'Matale'),
    (3, 3, 'Commercial Bank', '5555666677', 'Kurunegala')
  `);

  // ---- Milk Collections ----
  console.log('🥛 Seeding milk collections...');
  await conn.query(`INSERT IGNORE INTO milk_collections (id, farmer_id, chilling_center_id, date, time, temperature, quantity, milk_type, quality_result, failure_reason, dispatch_status) VALUES
    (1, 1, 1, '2026-03-15', '06:30:00', 4.2, 120, 'Cow', 'Pass', NULL, 'Approved'),
    (2, 2, 1, '2026-03-15', '07:00:00', 4.5, 95, 'Buffalo', 'Fail', 'Low FAT', 'Pending'),
    (3, 1, 1, '2026-03-14', '06:45:00', 4.0, 130, 'Cow', 'Pass', NULL, 'Dispatched'),
    (4, 3, 2, '2026-03-15', '06:15:00', 3.8, 200, 'Cow', 'Pass', NULL, 'Dispatched'),
    (5, 1, 1, '2026-03-13', '06:30:00', 4.1, 110, 'Goat', 'Pass', NULL, 'Approved')
  `);

  // ---- Quality Tests ----
  console.log('🔬 Seeding quality tests...');
  await conn.query(`INSERT IGNORE INTO quality_tests (id, collection_id, fat, snf, water, result, reason) VALUES
    (1, 1, 4.2, 8.8, 0.2, 'Pass', NULL),
    (2, 2, 3.0, 8.5, 0.3, 'Fail', 'Low FAT'),
    (3, 3, 3.8, 9.0, 0.1, 'Pass', NULL),
    (4, 4, 4.0, 8.9, 0.2, 'Pass', NULL),
    (5, 5, 3.9, 8.7, 0.3, 'Pass', NULL)
  `);

  // ---- Dispatches ----
  console.log('🚛 Seeding dispatches...');
  await conn.query(`INSERT IGNORE INTO dispatches (id, chilling_center_id, transporter_name, vehicle_number, driver_contact, dispatch_date, status) VALUES
    (1, 1, 'Lanka Transport', 'WP-AB-1234', '0771112233', '2026-03-14', 'Approved'),
    (2, 2, 'Express Dairy', 'NW-CD-5678', '0764445566', '2026-03-15', 'Dispatched')
  `);

  // ---- Dispatch Items ----
  console.log('📦 Seeding dispatch items...');
  await conn.query(`INSERT IGNORE INTO dispatch_items (id, dispatch_id, collection_id) VALUES
    (1, 1, 3),
    (2, 2, 4)
  `);

  // ---- Pricing Rules ----
  console.log('💰 Seeding pricing rules...');
  await conn.query(`INSERT IGNORE INTO pricing_rules (id, base_price_per_liter, fat_bonus, snf_bonus, effective_from, is_active) VALUES
    (1, 85, 2.5, 1.8, '2026-01-01', TRUE),
    (2, 80, 2.0, 1.5, '2025-07-01', FALSE)
  `);

  // ---- Payments ----
  console.log('💵 Seeding payments...');
  await conn.query(`INSERT IGNORE INTO payments (id, farmer_id, collection_id, quantity, base_pay, fat_bonus, snf_bonus, amount, status, paid_at) VALUES
    (1, 1, 1, 120, 10200, 300, 150, 10650, 'Paid', '2026-03-16 10:00:00'),
    (2, 1, 5, 110, 9350, 275, 110, 9735, 'Pending', NULL)
  `);

  // ---- Notifications ----
  console.log('🔔 Seeding notifications...');
  await conn.query(`INSERT IGNORE INTO notifications (id, user_id, title, message, type, is_read) VALUES
    (1, 10, 'Quality Test Passed', 'Your milk collection on 2026-03-15 passed quality testing.', 'quality_result', FALSE),
    (2, 10, 'Payment Completed', 'Payment of Rs. 10,650 has been credited.', 'payment', TRUE)
  `);

  console.log('✅ Seed complete!');
  await conn.end();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
