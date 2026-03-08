const express = require('express');
const router = express.Router();
const AccountRecord = require('../models/AccountRecord');
const ExtraYear = require('../models/ExtraYear');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

function toRecord(r) {
  const d = r.toObject ? r.toObject() : r;
  return {
    id: d.id,
    date: d.date,
    type: d.type,
    category: d.category || '',
    description: d.description || '',
    amount: d.amount,
    year: d.year,
    month: d.month,
    attachment: d.attachment || null,
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    const query = {};
    const y = year != null && year !== '' ? parseInt(String(year), 10) : null;
    const m = month != null && month !== '' ? parseInt(String(month), 10) : null;
    if (Number.isInteger(y)) query.year = y;
    if (Number.isInteger(m)) query.month = m;
    res.set('Cache-Control', 'no-store');
    const list = await AccountRecord.find(query).sort({ date: 1 }).lean();
    res.json(list.map(toRecord));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.get('/years', async (req, res) => {
  try {
    const fromRecords = await AccountRecord.distinct('year');
    const extra = await ExtraYear.find({}).lean();
    const extraYears = extra.map((e) => e.year);
    const combined = [...new Set([...fromRecords.filter(Boolean), ...extraYears])].filter(Boolean).sort((a, b) => b - a);
    if (combined.length === 0) {
      return res.json([new Date().getFullYear()]);
    }
    res.json(combined);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Delete year must be before POST /years so :year is not confused with other routes
router.delete('/years/:year', requireAdmin, async (req, res) => {
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Please enter a valid year (2000–2100).' });
    }
    const recordResult = await AccountRecord.deleteMany({ year });
    await ExtraYear.deleteOne({ year });
    res.json({ deleted: true, year, recordsDeleted: recordResult.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete year' });
  }
});

router.post('/years', requireAdmin, async (req, res) => {
  try {
    const year = Number(req.body?.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Please enter a valid year (2000–2100).' });
    }
    await ExtraYear.findOneAndUpdate({ year }, { year }, { upsert: true });
    res.json(year);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add year' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const dateStr = (body.date || '').slice(0, 10);
    const year = body.year != null ? Number(body.year) : null;
    const month = body.month != null ? Number(body.month) : null;
    let finalDate = dateStr;
    let finalYear = year;
    let finalMonth = month;
    if (dateStr) {
      const d = new Date(dateStr + 'T12:00:00');
      if (!Number.isNaN(d.getTime())) {
        finalYear = finalYear != null ? finalYear : d.getFullYear();
        finalMonth = finalMonth != null ? finalMonth : d.getMonth() + 1;
      }
    }
    if (finalYear == null || finalMonth == null || !Number.isInteger(finalYear) || !Number.isInteger(finalMonth)) {
      return res.status(400).json({ error: 'Date, year and month are required.' });
    }
    if (!finalDate) finalDate = `${finalYear}-${String(finalMonth).padStart(2, '0')}-01`;
    const type = body.type === 'Expense' ? 'Expense' : 'Income';
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Amount must be a non-negative number.' });
    }
    const id = `R${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const record = await AccountRecord.create({
      id,
      date: finalDate,
      type,
      category: String(body.category || '').trim(),
      description: String(body.description || '').trim(),
      amount,
      year: finalYear,
      month: finalMonth,
      attachment: body.attachment != null ? body.attachment : null,
    });
    res.status(201).json(toRecord(record));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to add record' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const record = await AccountRecord.findOne({ id });
    if (!record) return res.status(404).json({ error: 'Record not found' });
    if (updates.date !== undefined) record.date = String(updates.date).slice(0, 10);
    if (updates.type !== undefined) record.type = updates.type;
    if (updates.category !== undefined) record.category = updates.category;
    if (updates.description !== undefined) record.description = updates.description;
    if (updates.amount !== undefined) record.amount = Number(updates.amount);
    if (updates.year !== undefined) record.year = Number(updates.year);
    if (updates.month !== undefined) record.month = Number(updates.month);
    if (updates.attachment !== undefined) record.attachment = updates.attachment;
    await record.save();
    res.json(toRecord(record));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AccountRecord.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ error: 'Record not found' });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

module.exports = router;
