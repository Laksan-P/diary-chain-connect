const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [farmers] = await conn.query('SELECT * FROM farmers');
  fs.writeFileSync('farmers_data.json', JSON.stringify(farmers, null, 2));

  const [bankAccounts] = await conn.query('SELECT * FROM bank_accounts');
  fs.writeFileSync('bank_accounts_data.json', JSON.stringify(bankAccounts, null, 2));

  await conn.end();
}

main().catch(console.error);
