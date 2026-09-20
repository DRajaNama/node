const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routeIndex = require('./routes/index');
const path = require("path");

function createApp() {
  const app = express();
  const publicCors = cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  });
  const applicationCors = cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.use(express.json());
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static('uploads'));
  app.use((req, res, next) => (
    req.path.startsWith('/api/public/')
      ? publicCors(req, res, next)
      : applicationCors(req, res, next)
  ));
  app.use("/widgets",express.static(path.join(__dirname, "widgets")));

  app.get('/health', (req, res) => {
    res.send('OK');
  });

  app.use('/api', routeIndex);

  return app;
}

module.exports = createApp;
