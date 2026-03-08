const mongoose = require('mongoose');

const extraYearSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
});

module.exports = mongoose.model('ExtraYear', extraYearSchema);
