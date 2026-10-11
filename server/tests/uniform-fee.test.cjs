const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const root = path.join(process.cwd(), 'server');
let saved;
const pool = { execute: async (sql, params) => { saved = { sql, params }; return [{ insertId: 7 }]; } };
const database = path.join(root, 'config/database.js');
require.cache[database] = { id: database, filename: database, loaded: true, exports: pool };
const { normalizeUniformFee } = require(path.join(root, 'services/uniform-fee.js'));
const Student = require(path.join(root, 'models/student.js'));
const { registerStudent, exportStudentsToExcel } = require(path.join(root, 'controllers/studentController.js'));
const student = { index_number: 'TEST', name: 'Ama Mensah', gender: 'Female', level: 'Level 100', phone: '000', program: null, email: null };
test('Level 100 requires a valid Paid or Unpaid choice', () => {
  for (const level of ['Level 100', '100', 100, 'level 100']) {
    assert.equal(normalizeUniformFee(level, 'Paid'), 'Paid');
    assert.equal(normalizeUniformFee(level, 'Unpaid'), 'Unpaid');
    for (const status of [undefined, null, '', 'Pending', false]) assert.throws(() => normalizeUniformFee(level, status), /Select Paid or Unpaid/);
  }
});
test('Other levels do not acquire uniform fee status from stale form values', () => {
  assert.equal(normalizeUniformFee('Level 200', 'Paid'), null);
  assert.equal(normalizeUniformFee('Level 400', undefined), null);
});
test('Paid and Unpaid are passed to the database together with the student', async () => {
  for (const status of ['Paid', 'Unpaid']) {
    await Student.create({ ...student, uniform_fee_status: status });
    assert.ok(saved.sql.includes('uniform_fee_status'));
    assert.equal(saved.params.at(-1), status);
    assert.equal(saved.params[1], 'AMA MENSAH');
  }
  await Student.create({ ...student, level: 'Level 200', uniform_fee_status: 'Paid' });
  assert.equal(saved.params.at(-1), null);
});
test('Registration rejects a missing Level 100 choice before any insert', async () => {
  saved = null;
  let status, response;
  await registerStudent({ body: student }, { status(value) { status = value; return this; }, json(data) { response = data; } });
  assert.equal(status, 400); assert.match(response.error, /Select Paid or Unpaid/); assert.equal(saved, null);
});
test('Registration accepts both statuses and permits other levels without one', async () => {
  for (const body of [{ ...student, uniform_fee_status: 'Paid' }, { ...student, uniform_fee_status: 'Unpaid' }, { ...student, level: 'Level 200' }]) {
    let response;
    await registerStudent({ body }, { json(data) { response = data; }, status() { return this; } });
    assert.equal(response.success, true);
  }
});
test('Export shows Paid, Unpaid, unrecorded legacy students and non-applicable levels', async () => {
  const original = Student.findAllForExport;
  Student.findAllForExport = async () => [
    { ...student, uniform_fee_status: 'Paid' },
    { ...student, uniform_fee_status: 'Unpaid' },
    { ...student, uniform_fee_status: null },
    { ...student, level: 'Level 200', uniform_fee_status: null },
  ];
  try {
    let buffer;
    await exportStudentsToExcel({ query: {} }, { setHeader() {}, send(value) { buffer = value; } });
    const XLSX = require(path.join(root, 'node_modules/xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    assert.deepEqual(rows.map(row => row['Uniform Fee']), ['Paid', 'Unpaid', 'Not recorded', 'Not applicable']);
  } finally { Student.findAllForExport = original; }
});

test('Updating Unpaid to Paid changes only the uniform fee column', async () => {
  const original = pool.execute;
  const calls = [];
  pool.execute = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT')) return [[{ ...student, id: 7, uniform_fee_status: 'Unpaid' }]];
    return [{ affectedRows: 1 }];
  };
  try {
    assert.equal(await Student.updateUniformFee(7, 'Paid'), 'Paid');
    assert.equal(calls[1].sql, 'UPDATE students SET uniform_fee_status = ? WHERE id = ?');
    assert.deepEqual(calls[1].params, ['Paid', 7]);
  } finally { pool.execute = original; }
});
test('Updating other levels or invalid statuses is rejected without a database write', async () => {
  const original = pool.execute;
  let writes = 0;
  let record = { ...student, level: 'Level 200' };
  pool.execute = async sql => { if (sql.startsWith('SELECT')) return [[record]]; writes++; return [{ affectedRows: 1 }]; };
  try {
    await assert.rejects(Student.updateUniformFee(7, 'Paid'), /only to Level 100/);
    record = student;
    await assert.rejects(Student.updateUniformFee(7, 'Pending'), /Select Paid or Unpaid/);
    assert.equal(writes, 0);
  } finally { pool.execute = original; }
});
test('Update API returns the saved status and reports missing students', async () => {
  const { updateUniformFee } = require(path.join(root, 'controllers/studentController.js'));
  const original = Student.updateUniformFee;
  try {
    let response, code;
    const res = { json(data) { response = data; }, status(value) { code = value; return this; } };
    Student.updateUniformFee = async () => 'Paid';
    await updateUniformFee({ params: { id: '7' }, body: { uniform_fee_status: 'Paid' } }, res);
    assert.equal(response.success, true); assert.equal(response.uniform_fee_status, 'Paid');
    Student.updateUniformFee = async () => null;
    await updateUniformFee({ params: { id: '7' }, body: { uniform_fee_status: 'Paid' } }, res);
    assert.equal(code, 404);
    await updateUniformFee({ params: { id: '7' }, body: { uniform_fee_status: 'Pending' } }, res);
    assert.equal(code, 400);
  } finally { Student.updateUniformFee = original; }
});
