const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const AccountRecord = require('../models/AccountRecord');
const ExtraYear = require('../models/ExtraYear');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

/** Find record by id (custom string) or by _id (MongoDB ObjectId) for backwards compatibility. */
async function findRecordById(id) {
  const byCustomId = await AccountRecord.findOne({ id });
  if (byCustomId) return byCustomId;
  if (id && id.length === 24 && /^[a-fA-F0-9]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id)) {
    return AccountRecord.findById(id);
  }
  return null;
}

function toRecord(r) {
  const d = r.toObject ? r.toObject() : r;
  return {
    id: d.id != null ? String(d.id) : (d._id ? String(d._id) : ''),
    date: d.date || '',
    type: d.type || 'Income',
    category: d.category || '',
    description: d.description || '',
    amount: Number(d.amount) || 0,
    year: Number(d.year) || 0,
    month: Number(d.month) || 0,
    attachment: d.attachment != null ? d.attachment : null,
  };
}

router.use(authMiddleware);

// Debug: verify backend can read from DB (GET /api/accounts/db-check)
router.get('/db-check', async (req, res) => {
  try {
    const recordCount = await AccountRecord.countDocuments();
    const years = await AccountRecord.distinct('year');
    const collectionName = AccountRecord.collection.name;
    res.json({
      ok: true,
      recordCount,
      years: (years || []).sort((a, b) => b - a),
      collectionName,
    });
  } catch (err) {
    console.error('GET /accounts/db-check error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    const query = {};
    const y = year != null && year !== '' ? parseInt(String(year), 10) : null;
    const m = month != null && month !== '' ? parseInt(String(month), 10) : null;
    if (Number.isInteger(y)) query.year = y;
    if (Number.isInteger(m)) query.month = m;
    if (!Number.isInteger(y) && !Number.isInteger(m)) {
      const currentYear = new Date().getFullYear();
      query.year = { $gte: currentYear - 2 };
    }
    res.set('Cache-Control', 'no-store');
    // Year-only request (dashboard): skip attachment/description for speed and smaller payload
    const yearOnly = Number.isInteger(y) && !Number.isInteger(m);
    const projection = yearOnly ? 'date type amount year month' : null;
    const q = projection ? AccountRecord.find(query).select(projection) : AccountRecord.find(query);
    const list = await q.sort({ date: 1 }).lean();
    console.log(`[accounts] GET ?year=${y}&month=${m} -> ${list.length} records`);
    res.json(list.map(toRecord));
  } catch (err) {
    console.error('GET /api/accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.get('/years', async (req, res) => {
  try {
    const fromRecords = await AccountRecord.distinct('year');
    const extra = await ExtraYear.find({}).lean();
    const extraYears = (extra || []).map((e) => e.year).filter(Boolean);
    const recordYears = Array.isArray(fromRecords) ? fromRecords.filter(Boolean) : [];
    const combined = [...new Set([...recordYears, ...extraYears])].filter(Boolean).sort((a, b) => b - a);
    const years = combined.length > 0 ? combined : [new Date().getFullYear()];
    console.log('[accounts] GET /years ->', years.length, 'years:', years.slice(0, 8).join(', '));
    res.json(years);
  } catch (err) {
    console.error('GET /accounts/years error:', err);
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
    const record = await findRecordById(id);
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
    const record = await findRecordById(id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    await AccountRecord.deleteOne({ _id: record._id });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

module.exports = router;
