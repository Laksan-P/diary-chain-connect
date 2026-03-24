const fs = require('fs');
const path = require('path');

const content = [
  'PORT=4000',
  'DATABASE_URL=postgresql://postgres:02A2UJuuquBpSlvw@db.iazqhuuwoxjcziwuvswb.supabase.co:5432/postgres',
  'JWT_SECRET=nestle_dairy_jwt_secret_key_2026'
].join('\n');

fs.writeFileSync(path.join(__dirname, '.env'), content, { encoding: 'utf8' });
console.log('✅ .env file updated with .com variant');
