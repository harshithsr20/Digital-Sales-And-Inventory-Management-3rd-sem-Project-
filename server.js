// DukaanHub Server Entry
const app = require('./backend/src/server');
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please close the process using port ${PORT} or specify PORT=5001.`);
    } else {
      console.error('Server failed to start:', err.message);
    }
  });
}

module.exports = app;
