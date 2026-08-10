const createApp = require('./app');
const connectDB = require('./config/db');

if (process.env.NODE_ENV !== 'test') {
  require('./workers/email.worker');
  require('./workers/landingPage.worker');
}

const port = process.env.PORT || 3000;
const app = createApp();

connectDB();

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
