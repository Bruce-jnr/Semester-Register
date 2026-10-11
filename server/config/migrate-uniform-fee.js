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
      "SHOW COLUMNS FROM students LIKE 'uniform_fee_status'",
    );
    if (!columns.length) {
      await connection.execute(
        "ALTER TABLE students ADD COLUMN uniform_fee_status ENUM('Paid', 'Unpaid') NULL DEFAULT NULL",
      );
      console.log(
        'Added uniform fee status. Existing students remain unrecorded.',
      );
    } else console.log('Uniform fee status column is already present.');
  } finally {
    await connection.end();
  }
}
migrate().catch((error) => {
  console.error('Uniform fee migration failed:', error.message);
  process.exitCode = 1;
});
