const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './backend/.env' });

async function testLogin(email, password) {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
        console.log(`User ${email} NOT FOUND`);
        await conn.end();
        return;
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log(`Login for ${email}: ${valid ? 'SUCCESS' : 'FAILED (Invalid Password)'}`);
    console.log(`Role in DB: ${user.role}`);

    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function runTests() {
  console.log('--- Testing CC Staff ---');
  await testLogin('cc@nestle.com', 'password');
  console.log('\n--- Testing Nestlé Officer ---');
  await testLogin('nestle@nestle.com', 'password');
}

runTests();
