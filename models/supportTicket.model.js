const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, sparse: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportCategory', default: null },
    issueType: { type: String, enum: ['question', 'technical', 'billing', 'feedback', 'other'], default: 'other' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messages: [{
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      authorRole: { type: String, enum: ['user', 'admin', 'super_admin'], required: true },
      body: { type: String, required: true, trim: true, maxlength: 10000 },
      isInternal: { type: Boolean, default: false },
      attachments: [{
        storedName: { type: String, required: true },
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
      }],
      createdAt: { type: Date, default: Date.now },
    }],
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

supportTicketSchema.index({ userId: 1, updatedAt: -1 });
supportTicketSchema.index({ status: 1, priority: -1, updatedAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
