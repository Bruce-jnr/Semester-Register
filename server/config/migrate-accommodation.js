const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM students LIKE 'is_non_residential'",
    );
    if (!columns.length) {
      await connection.execute(
        'ALTER TABLE students ADD COLUMN is_non_residential BOOLEAN NOT NULL DEFAULT FALSE AFTER room_id',
      );
      console.log(
        'Added non-residential status. Existing students retain their current accommodation.',
      );
    } else console.log('Non-residential status column is already present.');
  } finally {
    await connection.end();
  }
}
migrate().catch((error) => {
  console.error('Accommodation migration failed:', error.message);
  process.exitCode = 1;
});
