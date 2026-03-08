const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password -loginHistory').lean();
    const list = users.map((u) => ({
      id: u._id?.toString() || u.id,
      username: u.username,
      role: u.role,
      displayName: u.displayName || '',
      profileImage: u.profileImage || '',
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
    }));
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const trimmed = (username || '').trim();
    const pass = password || '';
    if (!trimmed) return res.status(400).json({ error: 'Username is required' });
    if (!pass) return res.status(400).json({ error: 'Password is required' });
    const existing = await User.findOne({ username: { $regex: new RegExp(`^${trimmed}$`, 'i') } });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const newUser = new User({
      username: trimmed,
      password: pass,
      role: role === 'Admin' ? 'Admin' : 'Resident',
    });
    await newUser.save();
    res.status(201).json({
      id: newUser._id.toString(),
      username: newUser.username,
      role: newUser.role,
      displayName: newUser.displayName || '',
      profileImage: newUser.profileImage || '',
      isActive: newUser.isActive !== false,
      createdAt: newUser.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/bulk/active', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId, all, active } = req.body || {};
    const isActive = Boolean(active);
    if (all === true) {
      await User.updateMany({}, { $set: { isActive } });
      return res.json({ updated: 'all', isActive });
    }
    if (userId) {
      const user = await User.findByIdAndUpdate(userId, { $set: { isActive } }, { new: true });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ id: user._id.toString(), isActive });
    }
    return res.status(400).json({ error: 'Provide userId or all: true' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update users' });
  }
});

router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, password, profileImage, isActive } = req.body || {};
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (displayName !== undefined) user.displayName = String(displayName || '').trim();
    if (profileImage !== undefined) user.profileImage = String(profileImage || '');
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password !== undefined && password !== '') {
      user.password = password;
    }
    await user.save();
    res.json({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      displayName: user.displayName || '',
      profileImage: user.profileImage || '',
      isActive: user.isActive !== false,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/:id/login-history', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('loginHistory').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const list = Array.isArray(user.loginHistory) ? user.loginHistory : [];
    res.json(list.map((e) => ({ at: e.at, ip: e.ip || '', userAgent: e.userAgent || '' })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

module.exports = router;
