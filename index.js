const express = require('express');
const app = express();
const port = 3000;
const authRoute = require('./routes/authRoute');
const userRoute = require('./routes/userRoute');
const aiRoute = require('./routes/aiRoute');
const connectDB = require('./config/db');
connectDB();
app.use(express.json());

app.get('/health', (req, res) => {  
    res.send('OK');
});
// prefix /api for all routes
app.use('/api', authRoute);
app.use('/api', userRoute);
// app.use('/api',aiRoute);

app.listen(port, () => {  console.log(`Example app listening at http://localhost:${port}`);
});

