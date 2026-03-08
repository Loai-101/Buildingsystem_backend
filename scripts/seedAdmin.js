const User = require('../models/User');

const DEFAULT_ADMIN = {
  username: 'Mohammed',
  password: 'M37777614',
  role: 'Admin',
};

async function seedDefaultAdmin() {
  const existing = await User.findOne({ username: /^Mohammed$/i });
  if (existing) return;
  const admin = new User(DEFAULT_ADMIN);
  await admin.save();
  console.log('Default admin Mohammed seeded.');
}

module.exports = { seedDefaultAdmin };
