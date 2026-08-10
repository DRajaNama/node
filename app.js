const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routeIndex = require('./routes/index');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static('uploads'));
  app.use(
    cors({
      origin: 'http://localhost:4200',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    })
  );

  app.get('/health', (req, res) => {
    res.send('OK');
  });

  app.use('/api', routeIndex);

  return app;
}

module.exports = createApp;
