const express = require('express');
const router = express.Router();
const MaintenanceTicket = require('../models/MaintenanceTicket');
const Vendor = require('../models/Vendor');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/tickets', async (req, res) => {
  try {
    const list = await MaintenanceTicket.find({}).sort({ createdDate: -1 }).lean();
    const out = list.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category || 'General',
      priority: t.priority || 'Medium',
      status: t.status || 'Open',
      createdDate: t.createdDate || new Date(t.createdAt).toISOString().slice(0, 10),
      description: t.description || '',
    }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const { title, category, priority, description } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title required' });
    const ticket = await MaintenanceTicket.create({
      id: 'T' + Date.now(),
      title,
      category: category || 'General',
      priority: priority || 'Medium',
      status: 'Open',
      createdDate: new Date().toISOString().slice(0, 10),
      description: description || '',
    });
    res.status(201).json({
      id: ticket.id,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdDate: ticket.createdDate,
      description: ticket.description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const ticket = await MaintenanceTicket.findOne({ id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (updates.title !== undefined) ticket.title = updates.title;
    if (updates.category !== undefined) ticket.category = updates.category;
    if (updates.priority !== undefined) ticket.priority = updates.priority;
    if (updates.status !== undefined) ticket.status = updates.status;
    if (updates.description !== undefined) ticket.description = updates.description;
    await ticket.save();
    res.json({
      id: ticket.id,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdDate: ticket.createdDate,
      description: ticket.description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

router.get('/vendors', async (req, res) => {
  try {
    const list = await Vendor.find({}).lean();
    res.json(list.map((v) => ({ ...v, image: v.image || null })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.post('/vendors', requireAdmin, async (req, res) => {
  try {
    const { name, title, phone, category, image } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name required' });
    const id = 'v' + Date.now();
    const vendor = await Vendor.create({
      id,
      name: String(name).trim(),
      title: String(title || '').trim(),
      phone: String(phone || '').trim(),
      category: String(category || '').trim(),
      image: image || null,
    });
    res.status(201).json({
      id: vendor.id,
      name: vendor.name,
      title: vendor.title || '',
      phone: vendor.phone || '',
      category: vendor.category || '',
      image: vendor.image || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put('/vendors/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title, phone, category, image } = req.body || {};
    const vendor = await Vendor.findOne({ id });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    if (name !== undefined) vendor.name = String(name).trim();
    if (title !== undefined) vendor.title = String(title || '').trim();
    if (phone !== undefined) vendor.phone = String(phone || '').trim();
    if (category !== undefined) vendor.category = String(category || '').trim();
    if (image !== undefined) vendor.image = image || null;
    await vendor.save();
    res.json({
      id: vendor.id,
      name: vendor.name,
      title: vendor.title || '',
      phone: vendor.phone || '',
      category: vendor.category || '',
      image: vendor.image || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/vendors/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findOneAndDelete({ id });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = router;
