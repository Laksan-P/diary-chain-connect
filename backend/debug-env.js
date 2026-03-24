const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
console.log('Env file path:', envPath);
console.log('File exists:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('Content starts with:', JSON.stringify(content.substring(0, 30)));
  
  const parsed = dotenv.parse(content);
  console.log('Parsed DATABASE_URL exists:', !!parsed.DATABASE_URL);
  if (parsed.DATABASE_URL) {
    console.log('Parsed URL starts with:', parsed.DATABASE_URL.substring(0, 20));
  }
}
