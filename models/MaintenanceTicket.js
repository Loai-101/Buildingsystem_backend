const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, default: 'General' },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Open', 'In Progress', 'Done'], default: 'Open' },
  createdDate: { type: String },
  description: { type: String, default: '' },
});

ticketSchema.pre('save', function (next) {
  if (!this.createdDate) {
    this.createdDate = new Date().toISOString().slice(0, 10);
  }
  next();
});

module.exports = mongoose.model('MaintenanceTicket', ticketSchema);
