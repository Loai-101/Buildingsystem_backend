const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const loginEntrySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Resident'], default: 'Resident' },
  displayName: { type: String, trim: true, default: '' },
  profileImage: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  loginHistory: { type: [loginEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
