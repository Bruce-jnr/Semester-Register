const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../listen');

test('Passenger receives one listener serving the combined application without a TCP PORT', () => {
  let config, argumentsUsed;
  const passenger = { configure(value) { config = value; } };
  const server = {};
  const app = { listen(...args) { argumentsUsed = args; return server; } };
  assert.equal(startServer(app, {}, passenger), server);
  assert.deepEqual(config, { autoInstall: false });
  assert.equal(argumentsUsed[0], 'passenger');
});
test('Standalone hosting uses the configured port', () => {
  let argumentsUsed;
  startServer({ listen(...args) { argumentsUsed = args; } }, { PORT: '3102' }, null);
  assert.equal(argumentsUsed[0], 3102);
  assert.equal(argumentsUsed[1], '127.0.0.1');
});
test('Standalone hosting rejects missing, invalid and frontend ports', () => {
  for (const port of [undefined, '', 'bad', '0', '-1', '70000', '5173']) {
    assert.throws(() => startServer({ listen() { assert.fail('Must not listen'); } }, { PORT: port }, null), /Set PORT/);
  }
});
