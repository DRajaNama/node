const express = require('express');
const app = express();
const port = 3000;
const authRoute = require('./routes/authRoute');
const userRoute = require('./routes/userRoute');
const aiRoute = require('./routes/aiRoute');
const contactRoute = require('./routes/contactRoute')
const connectDB = require('./config/db');
const cors = require('cors');
connectDB();
app.use(express.json());

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
app.use('/api', authRoute);
app.use('/api', userRoute);
app.use('/api',aiRoute);
app.use('/api',contactRoute)

app.listen(port, () => {  console.log(`Example app listening at http://localhost:${port}`);
});

