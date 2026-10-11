# Registra

React/Vite student services frontend with an Express/MySQL API.
The nested Registration new folder is retained as the original reference.

## Setup

Use Node 22.12+ or a supported newer release. Keep DB_HOST, DB_USER, DB_PASSWORD,
DB_NAME, JWT_SECRET, PORT and optional ARKSEL_APIKEY / ARKSEL_SENDER_ID in the root .env.
Use PORT=3000 (5173 is reserved for Vite). Database secrets never use a VITE_ prefix.

1. Run npm install in the root and npm --prefix server install.
2. With MySQL running, run npm run seed if tables or initial accounts are missing.
   This creates missing tables and adds missing default accounts and sample rooms.
   It does not migrate the structure of existing tables. Change default passwords.
3. Run npm run dev to start both Vite and Express in one terminal. Ctrl+C stops both.
   To run them separately, use npm run dev:web and npm run dev:api.
4. Open http://localhost:5173.

## Production on the local server

Run npm run build then npm start. Express serves dist and API from the configured PORT.
Vite preview only previews static assets; use Express for the full built application.

## Roles

Registra: registration, students, allocation, rooms, payments, administrator passwords.
Accountant: payments, fee statistics, Excel exports, printed receipts.
Male/Female Host Awardee: their gender's students, statistics, exports.
Matron: student directory and statistics.

## Implementation

src/App.jsx contains shared React screens; src/api.js handles cookie-authenticated API calls.
server contains the adapted original controllers/models. Receipt printing retains the original
EJS print template. List searches run in MySQL and exports use the same search filters.
Allocation uses a transaction with gender validation and restores old room capacity on changes.
Receipt numbering is serialized with a MySQL advisory lock and a transaction.
Navigation uses local React state; reloading opens the overview.

## Accommodation

Run npm run migrate:accommodation once for existing databases. New seeded databases include the field.
Registration allows Residential or Non-residential. In Students, Set/Change accommodation can select
Non-residential or an available room. Changing to Non-residential frees the previous bed.
Non-residential students are excluded from Awaiting a room counts and lists; Excel includes their status.
Existing unallocated students remain awaiting a room until explicitly marked Non-residential.

## Level 100 uniform fees

Run npm run migrate:uniform-fee once for an existing database. Level 100 registration requires
a Paid or Unpaid choice. Other levels have no uniform fee status. Existing Level 100 records
remain Not recorded until their status is recorded; payment history is never inferred.
The directory and Excel exports include the status. Run npm run test:uniform-fee for regression checks.

Registrars can update a Level 100 uniform fee directly in Students using the Paid/Unpaid dropdown.
The change saves immediately and appears in subsequent exports. Other roles can only view the status.
