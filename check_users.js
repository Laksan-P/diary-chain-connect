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

    const [rows] = await conn.query('SELECT id, email, role FROM users');
    console.log('Users in database:', rows);
    await conn.end();
  } catch (err) {
    console.error('Error checking users:', err.message);
  }
}

checkUsers();
