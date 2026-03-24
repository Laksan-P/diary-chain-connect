const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testConnection() {
  console.log('DEBUG: test-conn.js loading DATABASE_URL:', !!process.env.DATABASE_URL);
  if (process.env.DATABASE_URL) {
    console.log('DEBUG: test-conn.js DATABASE_URL starts with:', process.env.DATABASE_URL.substring(0, 20));
  }
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connection successful!');
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed!');
    console.error(err);
  } finally {
    await client.end();
  }
}

testConnection();
