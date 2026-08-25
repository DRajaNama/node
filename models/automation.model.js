const mongoose = require('mongoose');
const {
  AUTOMATION_STATUS,
  AUTOMATION_TRIGGER,
  AUTOMATION_ACTION,
  AUTOMATION_EXECUTION_STATUS,
  AUTOMATION_CONDITION_TYPE,
  AUTOMATION_CONDITION_LOGIC,
  AUTOMATION_CONDITION_OPERATOR,
} = require('../constants/automation.constants');

const conditionRuleSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: {
      type: String,
      enum: Object.values(AUTOMATION_CONDITION_OPERATOR),
      required: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const conditionsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(AUTOMATION_CONDITION_TYPE),
      default: AUTOMATION_CONDITION_TYPE.ALL,
      required: true,
    },
    logic: {
      type: String,
      enum: Object.values(AUTOMATION_CONDITION_LOGIC),
      default: AUTOMATION_CONDITION_LOGIC.AND,
      required: true,
    },
    rules: { type: [conditionRuleSchema], default: [] },
  },
  { _id: false }
);

const automationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(AUTOMATION_STATUS),
      default: AUTOMATION_STATUS.ACTIVE,
      required: true,
      index: true,
    },
    triggerType: {
      type: String,
      enum: Object.values(AUTOMATION_TRIGGER),
      default: AUTOMATION_TRIGGER.NEW_LEAD,
      required: true,
      index: true,
    },
    conditions: {
      type: conditionsSchema,
      default: () => ({
        type: AUTOMATION_CONDITION_TYPE.ALL,
        logic: AUTOMATION_CONDITION_LOGIC.AND,
        rules: [],
      }),
      required: true,
    },
    actionType: {
      type: String,
      enum: Object.values(AUTOMATION_ACTION),
      required: true,
      index: true,
    },
    actionConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    secrets: { type: String, default: null, select: false },
    lastRunAt: { type: Date, default: null },
    lastExecutionStatus: {
      type: String,
      enum: [...Object.values(AUTOMATION_EXECUTION_STATUS), null],
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

automationSchema.index({ userId: 1, status: 1, triggerType: 1 });
automationSchema.index({ userId: 1, actionType: 1 });
automationSchema.index({ userId: 1, createdAt: -1 });

automationSchema.set('toJSON', {
  transform: (_doc, result) => {
    delete result.secrets;
    return result;
  },
});

module.exports = mongoose.model('Automation', automationSchema);
