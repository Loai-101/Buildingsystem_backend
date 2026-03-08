const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

const MAX_LOGIN_HISTORY = 50;

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const un = (username || '').trim();
    const pw = (password || '').trim();
    if (!un || !pw) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = await User.findOne({ username: { $regex: new RegExp(`^${un}$`, 'i') } });
    if (!user || !(await user.comparePassword(pw))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] || '').toString();
    const history = Array.isArray(user.loginHistory) ? user.loginHistory : [];
    history.unshift({ at: new Date(), ip, userAgent });
    user.loginHistory = history.slice(0, MAX_LOGIN_HISTORY);
    await user.save({ validateBeforeSave: false });
    const token = signToken(user);
    res.json({
      user: user.username,
      role: user.role,
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
