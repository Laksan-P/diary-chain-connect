const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkUsers() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await conn.query('SELECT id, email, role, password_hash FROM users');
    console.log('Users in database:');
    rows.forEach(row => {
        console.log(`ID: ${row.id}, Email: ${row.email}, Role: ${row.role}`);
    });
    
    // Check if password 'password' matches the hash for nestle@nestle.com
    const bcrypt = require('bcryptjs');
    const nestleUser = rows.find(u => u.email === 'nestle@nestle.com');
    if (nestleUser) {
        const matches = await bcrypt.compare('password', nestleUser.password_hash);
        console.log(`Password 'password' matches nestle@nestle.com hash: ${matches}`);
    } else {
        console.log('nestle@nestle.com not found');
    }

    await conn.end();
  } catch (err) {
    console.error('Error checking users:', err.message);
  }
}

checkUsers();
