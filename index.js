const createApp = require('./app');
const connectDB = require('./config/db');
const Automation = require('./models/automation.model');
const AutomationExecution = require('./models/automationExecution.model');
const PlanService = require('./services/plan.services');
const logger = require('./helpers/logging');
const http = require('http');
const RealtimeService = require('./services/realtime.services');

const port = process.env.PORT || 3000;
const app = createApp();

const start = async () => {
  await connectDB();
  await Promise.all([
    Automation.createIndexes(),
    AutomationExecution.createIndexes(),
  ]);
  await PlanService.ensureAutomationWorkflowEntitlements();
  await PlanService.ensureIntegrationEntitlements();

  if (process.env.NODE_ENV !== 'test') {
    require('./workers/email.worker');
    require('./workers/landingPage.worker');
    require('./workers/automation.worker');
  }

  const server = http.createServer(app);
  RealtimeService.initialize(server);
  server.listen(port, () => {
    logger.info(`Server listening at http://localhost:${port}`);
  });
};

start().catch((error) => {
  logger.error('Application startup failed', error);
  process.exit(1);
});
