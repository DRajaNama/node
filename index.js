const express = require('express');
const app = express();
const port = 3000;
const routeIndex = require('./routes/index');
const connectDB = require('./config/db');
const helmet = require('helmet')
const cors = require('cors');
require('./workers/email.worker');
require('./workers/landingPage.worker');
connectDB();
app.use(express.json());


app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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
// prefix /api for all routes
app.use('/api', routeIndex);

app.listen(port, () => {  console.log(`Example app listening at http://localhost:${port}`);
});

