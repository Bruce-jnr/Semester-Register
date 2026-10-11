function startServer(app, env = process.env, passenger = global.PhusionPassenger) {
  if (passenger) {
    passenger.configure({ autoInstall: false });
    return app.listen('passenger', () => console.log('Registra frontend and API started under Passenger'));
  }
  const port = Number(env.PORT);
  if (!env.PORT || !Number.isInteger(port) || port < 1 || port > 65535 || port === 5173) {
    throw new Error('Set PORT to a valid API port between 1 and 65535, other than 5173');
  }
  return app.listen(port, '127.0.0.1', () => console.log('Registra frontend and API listening on http://localhost:' + port));
}

module.exports = { startServer };
