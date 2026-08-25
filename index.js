const createApp = require('./app');
const connectDB = require('./config/db');
const Automation = require('./models/automation.model');
const AutomationExecution = require('./models/automationExecution.model');
const PlanService = require('./services/plan.services');
const logger = require('./helpers/logging');

const port = process.env.PORT || 3000;
const app = createApp();

const start = async () => {
  await connectDB();
  await Promise.all([
    Automation.createIndexes(),
    AutomationExecution.createIndexes(),
  ]);
  await PlanService.ensureAutomationWorkflowEntitlements();

  if (process.env.NODE_ENV !== 'test') {
    require('./workers/email.worker');
    require('./workers/landingPage.worker');
    require('./workers/automation.worker');
  }

  app.listen(port, () => {
    logger.info(`Server listening at http://localhost:${port}`);
  });
};

start().catch((error) => {
  logger.error('Application startup failed', error);
  process.exit(1);
});
