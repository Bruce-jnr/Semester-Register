const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const root = path.join(process.cwd(), 'server');
let calls = [];
const pool = { execute: async (sql, params) => { calls.push({ sql, params }); return sql.includes('COUNT(') ? [[{ total: 1 }]] : [[]]; } };
const database = path.join(root, 'config/database.js');
require.cache[database] = { id: database, filename: database, loaded: true, exports: pool };
const Student = require(path.join(root, 'models/student.js'));
test('Registrar room filter applies to both records and pagination counts', async () => {
  calls = [];
  const result = await Student.findAll(2, 50, null, null, '', 'M101');
  assert.equal(result.total, 1); assert.equal(result.page, 2);
  for (const call of calls) { assert.ok(call.sql.includes('r.room_number = ?')); assert.ok(call.sql.includes('JOIN rooms r')); assert.deepEqual(call.params, ['M101']); }
  assert.ok(calls[0].sql.includes('LIMIT 50, 50'));
});
test('Room selection combines with gender, level and search', async () => {
  calls = [];
  await Student.findAll(1, 50, 'Female', 'Level 100', 'Ama', 'F101');
  for (const call of calls) {
    assert.ok(call.sql.includes('s.gender = ?')); assert.ok(call.sql.includes('s.level = ?'));
    assert.ok(call.sql.includes('LIKE ?')); assert.ok(call.params.includes('F101'));
    assert.ok(call.params.includes('Female')); assert.ok(call.params.includes('Level 100')); assert.ok(call.params.includes('%Ama%'));
  }
});
test('Registrar Excel export uses the same room filter', async () => {
  calls = []; await Student.findAllForExport(null, null, '', 'M101');
  assert.ok(calls[0].sql.includes('r.room_number = ?')); assert.deepEqual(calls[0].params, ['M101']);
});
test('Warden lists and exports retain gender constraints together with room selection', async () => {
  calls = []; await Student.findByGender('Female', 1, 50, null, 'F101');
  await Student.findAllByGenderForExport('Female', null, 'F101');
  for (const call of calls) { assert.ok(call.sql.includes('s.gender = ?')); assert.ok(call.sql.includes('r.room_number = ?')); assert.deepEqual(call.params, ['Female', 'F101']); }
});
test('All rooms selection adds no room constraint', async () => {
  calls = []; await Student.findAll(1, 50);
  assert.ok(calls.every(call => !call.sql.includes('r.room_number = ?')));
});
test('Room option lookup is scoped to the selected gender', async () => {
  calls = []; await Student.getDistinctRoomNumbers('Male');
  assert.ok(calls[0].sql.includes('s.gender = ?')); assert.deepEqual(calls[0].params, ['Male']);
});
test('Directory and export controllers forward the room query', async () => {
  const { getAllStudents, exportStudentsToExcel } = require(path.join(root, 'controllers/studentController.js'));
  const originalList = Student.findAll, originalExport = Student.findAllForExport;
  let listArgs, exportArgs;
  Student.findAll = async (...args) => { listArgs = args; return { students: [], total: 0, page: 1, limit: 50, totalPages: 0 }; };
  Student.findAllForExport = async (...args) => { exportArgs = args; return []; };
  try {
    const req = { query: { room_number: 'M101' } };
    await getAllStudents(req, { json() {} });
    await exportStudentsToExcel(req, { setHeader() {}, send() {} });
    assert.equal(listArgs.at(-1), 'M101'); assert.equal(exportArgs.at(-1), 'M101');
  } finally { Student.findAll = originalList; Student.findAllForExport = originalExport; }
});
