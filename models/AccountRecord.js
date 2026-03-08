const mongoose = require('mongoose');

// All records are stored in ONE collection "accountrecords".
// Each document has year + month; we filter by them when loading a month (no separate folders).
const accountRecordSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  type: { type: String, enum: ['Income', 'Expense'], required: true },
  category: { type: String, default: '' },
  description: { type: String, default: '' },
  amount: { type: Number, required: true, default: 0 },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  attachment: { type: String, default: null },
}, { collection: 'accountrecords' });

module.exports = mongoose.model('AccountRecord', accountRecordSchema);
