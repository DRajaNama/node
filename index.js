const express = require('express');
const app = express();
const port = 3000;
const authRoute = require('./routes/authRoute');
const userRoute = require('./routes/userRoute');
const aiRoute = require('./routes/aiRoute');
const contactRoute = require('./routes/contactRoute')
const listRoute = require('./routes/listRoute')
const templateCategoryRoute = require('./routes/templateCategoryRoute')
const templateRoute = require('./routes/templateRoute')
const campaignRoute = require('./routes/campaignRoute')
const connectDB = require('./config/db');
const helmet = require('helmet')
const cors = require('cors');
require('./workers/email.worker');
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
app.use('/api', authRoute);
app.use('/api', userRoute);
app.use('/api',aiRoute);
app.use('/api',contactRoute)
app.use('/api',listRoute)
app.use('/api',templateCategoryRoute)
app.use('/api',templateRoute);
app.use('/api',campaignRoute);

app.listen(port, () => {  console.log(`Example app listening at http://localhost:${port}`);
});

