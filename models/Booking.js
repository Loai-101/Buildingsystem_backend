const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  name: { type: String, required: true },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdDate: { type: Date, default: Date.now },
});

bookingSchema.index({ date: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdDate: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
