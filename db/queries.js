const pool = require('./pool');

// Convert NUMERIC columns from the pg string representation to JS numbers.
// pg returns NUMERIC as strings by default to avoid float precision loss.
function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    quality_score:    row.quality_score    != null ? parseFloat(row.quality_score)    : null,
    amount_requested: row.amount_requested != null ? parseFloat(row.amount_requested) : null,
    annual_budget:    row.annual_budget    != null ? parseFloat(row.annual_budget)    : null,
  };
}

// Insert a new submission. Accepts any subset of valid column names.
// Column names in `data` must match the schema exactly (snake_case).
async function createSubmission(data) {
  const keys = Object.keys(data).filter(k => data[k] !== undefined);
  const columns = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map(k => data[k]);

  const result = await pool.query(
    `INSERT INTO submissions (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return parseRow(result.rows[0]);
}

// Fetch a single submission by ID. Returns null if not found.
async function getSubmission(id) {
  const result = await pool.query(
    'SELECT * FROM submissions WHERE id = $1',
    [String(id)]
  );
  return parseRow(result.rows[0] || null);
}

// Update only the provided fields on a submission. SET clause is built
// dynamically from Object.keys(fields) — no column list is hardcoded.
// Returns the updated record, or null if not found.
async function updateSubmission(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = [String(id), ...keys.map(k => fields[k])];

  const result = await pool.query(
    `UPDATE submissions SET ${setClause} WHERE id = $1 RETURNING *`,
    values
  );
  return parseRow(result.rows[0] || null);
}

// Return all submissions, newest first.
async function getAllSubmissions() {
  const result = await pool.query(
    'SELECT * FROM submissions ORDER BY submitted_at DESC'
  );
  return result.rows.map(parseRow);
}

// Return all submissions with the given status, newest first.
async function getSubmissionsByStatus(status) {
  const result = await pool.query(
    'SELECT * FROM submissions WHERE status = $1 ORDER BY submitted_at DESC',
    [status]
  );
  return result.rows.map(parseRow);
}

// Return a promo_code record if the code is valid and has remaining uses.
// Returns null if the code does not exist, is inactive, expired, or exhausted.
async function validatePromoCode(code) {
  const result = await pool.query(
    `SELECT * FROM promo_codes
     WHERE code = $1
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > NOW())
       AND times_used < max_uses`,
    [code]
  );
  return result.rows[0] || null;
}

// Increment the usage counter for a promo code.
async function redeemPromoCode(code) {
  await pool.query(
    'UPDATE promo_codes SET times_used = times_used + 1 WHERE code = $1',
    [code]
  );
}

// Create a new promo code. expiryDays is the number of days until expiry;
// pass null for no expiry. Code is stored uppercased.
// Returns the inserted record, or null if the code already exists.
async function createPromoCode(code, description, maxUses, expiryDays) {
  const expiresAt = expiryDays != null
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const result = await pool.query(
    `INSERT INTO promo_codes (code, description, max_uses, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code) DO NOTHING
     RETURNING *`,
    [code.toUpperCase(), description || null, maxUses, expiresAt]
  );
  return result.rows[0] || null;
}

module.exports = {
  createSubmission,
  getSubmission,
  updateSubmission,
  getAllSubmissions,
  getSubmissionsByStatus,
  validatePromoCode,
  redeemPromoCode,
  createPromoCode,
};
