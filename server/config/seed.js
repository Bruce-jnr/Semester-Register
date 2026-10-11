const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Create a connection without database first
async function createDatabaseConnection() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'student_registration_db';
  
  console.log(`Connecting to MySQL as ${dbUser}@${dbHost}...`);
  
  try {
    const connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword
    });
    
    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    await connection.end();
    
    console.log(`Database ${dbName} created/verified successfully`);
    
    // Now create pool with database
    const pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test the pool connection
    const testConnection = await pool.getConnection();
    testConnection.release();
    console.log('Database pool connected successfully');
    
    return pool;
  } catch (error) {
    console.error('\n=== Database Connection Error ===');
    console.error('Error:', error.message);
    console.error('\nPlease verify:');
    console.error(`- MySQL is running on ${dbHost}`);
    console.error(`- Username: ${dbUser}`);
    console.error(`- Password is correct`);
    console.error(`- User has necessary privileges\n`);
    throw error;
  }
}

let pool;

async function createTables() {
  try {
    pool = await createDatabaseConnection();

    // Create admins table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('Male Host Awardee', 'Female Host Awardee', 'Accountant', 'Registra', 'Matron') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rooms table first (students table has foreign key to rooms)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_number VARCHAR(20) UNIQUE NOT NULL,
        gender_type ENUM('Male', 'Female') NOT NULL,
        capacity INT NOT NULL,
        current_capacity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create students table (after rooms since it has foreign key to rooms)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        index_number VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        gender ENUM('Male', 'Female') NOT NULL,
        program VARCHAR(100) NULL,
        level VARCHAR(50) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100) NULL,
        room_id INT NULL,
        is_non_residential BOOLEAN NOT NULL DEFAULT FALSE,
        uniform_fee_status ENUM('Paid', 'Unpaid') NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
      )
    `);

    await pool.execute(`CREATE TABLE IF NOT EXISTS fees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      index_number VARCHAR(50) NOT NULL,
      student_name VARCHAR(100) NOT NULL,
      level VARCHAR(50) NOT NULL,
      amount_paid DECIMAL(12,2) NOT NULL,
      payment_method ENUM('GCB', 'CBG', 'CBG USSD') NOT NULL,
      date_paid DATE NOT NULL,
      receipt_number VARCHAR(100) UNIQUE NOT NULL,
      college_receipt_number VARCHAR(30) UNIQUE NULL,
      receipt_issued BOOLEAN NOT NULL DEFAULT FALSE,
      receipt_issued_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Tables created successfully');
    return true;
  } catch (error) {
    console.error('Error creating tables:', error.message);
    throw error; // Re-throw to stop execution
  }
}

async function seedAdmins() {
  if (!pool) {
    throw new Error('Database pool is not initialized');
  }
  
  try {
    const admins = [
      { username: 'malehost', password: 'password123', role: 'Male Host Awardee' },
      { username: 'femalehost', password: 'password123', role: 'Female Host Awardee' },
      { username: 'accountant', password: 'password123', role: 'Accountant' },
      { username: 'registra', password: 'password123', role: 'Registra' },
      { username: 'matron', password: 'password123', role: 'Matron' }
    ];

    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      await pool.execute(
        'INSERT IGNORE INTO admins (username, password, role) VALUES (?, ?, ?)',
        [admin.username, hashedPassword, admin.role]
      );
    }

    console.log('Admins seeded successfully');
    console.log('Default credentials:');
    console.log('- malehost / password123 (Male Host Awardee - View Only)');
    console.log('- femalehost / password123 (Female Host Awardee - View Only)');
    console.log('- accountant / password123 (Accountant - View Statistics)');
    console.log('- registra / password123 (Registra - Full Access, Can Register Students)');
    console.log('- matron / password123 (Matron - View Students Only)');
  } catch (error) {
    console.error('Error seeding admins:', error.message);
    throw error;
  }
}

async function seedRooms() {
  if (!pool) {
    throw new Error('Database pool is not initialized');
  }
  
  try {
    const rooms = [
      { room_number: 'M101', gender_type: 'Male', capacity: 4 },
      { room_number: 'M102', gender_type: 'Male', capacity: 4 },
      { room_number: 'M103', gender_type: 'Male', capacity: 3 },
      { room_number: 'F101', gender_type: 'Female', capacity: 4 },
      { room_number: 'F102', gender_type: 'Female', capacity: 4 },
      { room_number: 'F103', gender_type: 'Female', capacity: 3 }
    ];

    for (const room of rooms) {
      await pool.execute(
        'INSERT IGNORE INTO rooms (room_number, gender_type, capacity, current_capacity) VALUES (?, ?, ?, ?)',
        [room.room_number, room.gender_type, room.capacity, room.capacity]
      );
    }

    console.log('Rooms seeded successfully');
  } catch (error) {
    console.error('Error seeding rooms:', error.message);
    throw error;
  }
}

async function seed() {
  try {
    await createTables();
    await seedAdmins();
    await seedRooms();
    console.log('Database seeded successfully!');
    if (pool) await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    if (pool) await pool.end();
    process.exit(1);
  }
}

seed();

