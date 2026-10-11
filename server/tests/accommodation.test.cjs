const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const root = path.join(process.cwd(), 'server');
let state, trace, snapshot;
const connection = {
  async beginTransaction() { trace.push('begin'); snapshot = structuredClone(state); },
  async query() { trace.push('lock rooms'); return [state.rooms]; },
  async execute(sql, params) {
    trace.push(sql);
    if (sql.startsWith('SELECT * FROM students')) return [state.student ? [structuredClone(state.student)] : []];
    if (sql.startsWith('UPDATE students')) { state.student.room_id = params[0]; state.student.is_non_residential = params[1]; }
    if (sql.includes('current_capacity - 1')) state.rooms.find(room => room.id === params[0]).current_capacity--;
    if (sql.includes('LEAST(')) { const room = state.rooms.find(room => room.id === params[0]); room.current_capacity = Math.min(room.capacity, room.current_capacity + 1); }
    return [{ affectedRows: 1 }];
  },
  async commit() { trace.push('commit'); },
  async rollback() { trace.push('rollback'); state = snapshot; },
  release() { trace.push('release'); },
};
const database = path.join(root, 'config/database.js');
const pool = { getConnection: async () => connection };
require.cache[database] = { id: database, filename: database, loaded: true, exports: pool };
const { setAccommodation } = require(path.join(root, 'services/accommodation.js'));
function reset(overrides = {}) {
  trace = [];
  state = { student: { id: 1, gender: 'Female', room_id: null, is_non_residential: false, ...overrides }, rooms: [{ id: 2, gender_type: 'Female', capacity: 4, current_capacity: 3 }, { id: 3, gender_type: 'Male', capacity: 4, current_capacity: 3 }] };
}
test('An awaiting student can become non-residential without consuming a bed', async () => {
  reset(); const before = structuredClone(state.rooms);
  const result = await setAccommodation(1, 'non-residential');
  assert.equal(result.nonResidential, true);
  assert.equal(state.student.room_id, null);
  assert.equal(state.student.is_non_residential, true);
  assert.deepEqual(state.rooms, before);
  assert.ok(trace.includes('commit')); assert.equal(trace.at(-1), 'release');
});
test('Changing a resident to non-residential frees exactly one bed', async () => {
  reset({ room_id: 2 });
  await setAccommodation(1, 'non-residential');
  assert.equal(state.student.room_id, null); assert.equal(state.student.is_non_residential, true);
  assert.equal(state.rooms[0].current_capacity, 4);
  await setAccommodation(1, 'non-residential');
  assert.equal(state.rooms[0].current_capacity, 4);
});
test('Allocating a room to a non-residential student clears the flag', async () => {
  reset({ is_non_residential: true });
  const result = await setAccommodation(1, 2);
  assert.equal(result.nonResidential, false); assert.equal(state.student.is_non_residential, false);
  assert.equal(state.student.room_id, 2); assert.equal(state.rooms[0].current_capacity, 2);
});
test('Wrong gender and full rooms leave accommodation unchanged', async () => {
  reset({ is_non_residential: true });
  const before = structuredClone(state);
  await assert.rejects(setAccommodation(1, 3), /matching/);
  assert.deepEqual(state, before); assert.ok(trace.includes('rollback')); assert.equal(trace.at(-1), 'release');
  reset({ is_non_residential: true }); state.rooms[0].current_capacity = 0;
  await assert.rejects(setAccommodation(1, 2), /full/);
  assert.equal(state.student.is_non_residential, true);
});
test('Invalid choices are rejected before a transaction', async () => {
  reset(); await assert.rejects(setAccommodation(1, 'invalid'), /Choose a room/);
  await assert.rejects(setAccommodation(0, 'non-residential'), /student ID/);
  assert.deepEqual(trace, []);
});
test('Non-residential changes do not send room-allocation SMS', async () => {
  reset();
  const smsPath = path.join(root, 'services/smsService.js');
  let sends = 0;
  require.cache[smsPath] = { id: smsPath, filename: smsPath, loaded: true, exports: { sendRoomAllocationSMS: async () => { sends++; } } };
  const { allocateRoom } = require(path.join(root, 'controllers/studentController.js'));
  let response;
  await allocateRoom({ body: { studentId: 1, roomId: 'non-residential' } }, { json(data) { response = data; }, status() { return this; } });
  assert.equal(response.success, true); assert.equal(sends, 0);
});
test('Non-residential students are excluded from waiting counts and queries', async () => {
  const Student = require(path.join(root, 'models/student.js'));
  const queries = [];
  pool.execute = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('GROUP BY')) return [[]];
    if (sql.includes('room_id IS NULL')) return [[]];
    if (sql.includes('is_non_residential = TRUE')) return [[{ count: 2 }]];
    if (sql.includes('room_id IS NOT NULL')) return [[{ count: 3 }]];
    return [[{ count: 10 }]];
  };
  const stats = await Student.getStats('Female');
  assert.equal(stats.nonResidential, 2); assert.equal(stats.unallocated, 5);
  const counted = queries.find(query => query.sql.includes('is_non_residential = TRUE'));
  assert.ok(counted.sql.includes('AND gender = ?')); assert.deepEqual(counted.params, ['Female']);
  await Student.findUnallocated('Female');
  assert.ok(queries.at(-1).sql.includes('is_non_residential = FALSE'));
});
test('Excel exports distinguish non-residential students from waiting students', async () => {
  const Student = require(path.join(root, 'models/student.js'));
  const students = [{ id: 1, name: 'Nonresident', is_non_residential: true, room_id: null }, { id: 2, name: 'Waiting', is_non_residential: false, room_id: null }];
  const original = Student.findAllForExport;
  Student.findAllForExport = async () => students;
  try {
    const { exportStudentsToExcel } = require(path.join(root, 'controllers/studentController.js'));
    let buffer;
    await exportStudentsToExcel({ query: {} }, { setHeader() {}, send(value) { buffer = value; } });
    const XLSX = require(path.join(root, 'node_modules/xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    assert.equal(rows[0].Status, 'Non-residential'); assert.equal(rows[0]['Room Number'], 'Not applicable');
    assert.equal(rows[1].Status, 'Awaiting a room');
  } finally { Student.findAllForExport = original; }
});

test('Changing rooms frees the old bed and occupies the new bed', async () => {
  reset({ room_id: 2 });
  state.rooms.push({ id: 4, gender_type: 'Female', capacity: 4, current_capacity: 2 });
  await setAccommodation(1, 4);
  assert.equal(state.student.room_id, 4);
  assert.equal(state.student.is_non_residential, false);
  assert.equal(state.rooms.find(room => room.id === 2).current_capacity, 4);
  assert.equal(state.rooms.find(room => room.id === 4).current_capacity, 1);
  assert.equal(state.rooms.find(room => room.id === 3).current_capacity, 3);
  assert.ok(trace.includes('commit'));
});
test('Reallocation to a full room preserves the old room and both capacities', async () => {
  reset({ room_id: 2 });
  state.rooms.push({ id: 4, gender_type: 'Female', capacity: 4, current_capacity: 0 });
  const before = structuredClone(state);
  await assert.rejects(setAccommodation(1, 4), /full/);
  assert.deepEqual(state, before);
  assert.ok(trace.includes('rollback'));
});
test('Selecting the current room cannot consume another bed', async () => {
  reset({ room_id: 2 });
  const before = structuredClone(state);
  await assert.rejects(setAccommodation(1, 2), /already/);
  assert.deepEqual(state, before);
});
test('A database failure during reallocation rolls back the student and both rooms', async () => {
  reset({ room_id: 2 });
  state.rooms.push({ id: 4, gender_type: 'Female', capacity: 4, current_capacity: 2 });
  const before = structuredClone(state);
  const original = connection.execute;
  connection.execute = async function(sql, params) {
    if (sql.includes('LEAST(')) throw new Error('Simulated database failure');
    return original.call(this, sql, params);
  };
  try {
    await assert.rejects(setAccommodation(1, 4), /database failure/);
    assert.deepEqual(state, before);
    assert.ok(trace.includes('rollback'));
    assert.equal(trace.at(-1), 'release');
  } finally { connection.execute = original; }
});

test('Student names are trimmed and uppercased before the database insert', async () => {
  const Student = require(path.join(root, 'models/student.js'));
  const original = pool.execute;
  let saved;
  pool.execute = async (sql, params) => { saved = { sql, params }; return [{ insertId: 42 }]; };
  try {
    const id = await Student.create({ index_number: 'TEST', name: '  Ama Nyantakyi  ', gender: 'Female', program: null, level: 'Level 100', uniform_fee_status: 'Unpaid', phone: '000', email: null });
    assert.equal(id, 42);
    assert.ok(saved.sql.startsWith('INSERT INTO students'));
    assert.equal(saved.params[1], 'AMA NYANTAKYI');
  } finally { pool.execute = original; }
});
