const mongoose = require('mongoose');
const {
  AUTOMATION_ACTION,
  AUTOMATION_EXECUTION_STATUS,
  AUTOMATION_TRIGGER_MODE,
} = require('../constants/automation.constants');

const automationExecutionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    automationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Automation',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: Object.values(AUTOMATION_ACTION),
      required: true,
    },
    actionConfigSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },
    secretsSnapshot: { type: String, default: null, select: false },
    status: {
      type: String,
      enum: Object.values(AUTOMATION_EXECUTION_STATUS),
      default: AUTOMATION_EXECUTION_STATUS.PENDING,
      required: true,
      index: true,
    },
    triggerMode: {
      type: String,
      enum: Object.values(AUTOMATION_TRIGGER_MODE),
      default: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
      required: true,
    },
    dedupeKey: { type: String, default: null },
    dispatchKey: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
    responseStatus: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

automationExecutionSchema.index({ automationId: 1, createdAt: -1 });
automationExecutionSchema.index({ userId: 1, createdAt: -1 });
automationExecutionSchema.index({ leadId: 1, createdAt: -1 });
automationExecutionSchema.index({ automationId: 1, status: 1, createdAt: -1 });
automationExecutionSchema.index(
  { automationId: 1, leadId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: AUTOMATION_TRIGGER_MODE.FIRST_TIME },
  }
);

automationExecutionSchema.set('toJSON', {
  transform: (_doc, result) => {
    delete result.actionConfigSnapshot;
    delete result.secretsSnapshot;
    return result;
  },
});
automationExecutionSchema.index(
  { automationId: 1, leadId: 1, dispatchKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dispatchKey: { $type: 'string' } },
  }
);

module.exports = mongoose.model('AutomationExecution', automationExecutionSchema);
