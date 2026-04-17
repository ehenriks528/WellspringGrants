const pool = require('./pool');
const queries = require('./queries');

module.exports = { pool, ...queries };
