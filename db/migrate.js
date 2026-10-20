require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    await pool.query(schema);
    await pool.query(fs.readFileSync(path.join(__dirname, '../acquisition/schema.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(__dirname, '../acquisition/drafts.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(__dirname, '../acquisition/funnel.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(__dirname, '../acquisition/fulfillment.sql'), 'utf8'));
    console.log('Migration complete — schema is up to date.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
