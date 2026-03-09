const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  proposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal', required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  vote: { type: String, enum: ['approve', 'reject'], required: true },
}, { timestamps: true, collection: 'votes' });

voteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
