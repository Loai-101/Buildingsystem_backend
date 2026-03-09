const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  createdBy: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true, collection: 'proposals' });

proposalSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Proposal', proposalSchema);
