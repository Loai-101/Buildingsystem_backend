const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  title: { type: String, default: '' },
  phone: { type: String, default: '' },
  category: { type: String, default: '' },
  image: { type: String, default: null },
});

module.exports = mongoose.model('Vendor', vendorSchema);
