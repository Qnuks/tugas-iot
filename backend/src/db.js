const { Pool } = require("pg");
const config = require("./config");

if (!config.databaseUrl) {
  console.warn("DATABASE_URL belum diisi. API database tidak akan berjalan normal.");
}

const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: config.databaseUrl ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
