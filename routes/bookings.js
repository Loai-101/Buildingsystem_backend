const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { authMiddleware } = require('../middleware/auth');

const MIN_GAP_MINUTES = 3 * 60;

function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const parts = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!parts) return null;
  const h = parseInt(parts[1], 10);
  const m = parseInt(parts[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function bookingRange(b) {
  const s = timeToMinutes(b.startTime);
  const e = timeToMinutes(b.endTime);
  if (s == null && e == null) return [0, 24 * 60];
  if (s != null && e != null) return [Math.min(s, e), Math.max(s, e)];
  if (s != null) return [s, s + 60];
  return [e - 60, e];
}

function hasMinGap(start1, end1, start2, end2) {
  return end1 + MIN_GAP_MINUTES <= start2 || end2 + MIN_GAP_MINUTES <= start1;
}

function hasApprovedBookingOnDate(bookings, dateStr, excludeId) {
  return bookings.some(
    (b) => b.id !== excludeId && b.status === 'Approved' && (b.date || '').slice(0, 10) === dateStr
  );
}

function conflictsWithSameDay(b, others, excludeId) {
  const [s, e] = bookingRange(b);
  for (const o of others) {
    if (o.id === excludeId) continue;
    if ((o.date || '').slice(0, 10) !== (b.date || '').slice(0, 10)) continue;
    const [s2, e2] = bookingRange(o);
    if (!hasMinGap(s, e, s2, e2)) return true;
  }
  return false;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toBookingDoc(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return {
    id: d.id,
    date: d.date,
    startTime: d.startTime || '',
    endTime: d.endTime || '',
    name: d.name,
    notes: d.notes || '',
    status: d.status,
    createdDate: d.createdDate,
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const list = await Booking.find({}).sort({ createdDate: -1 }).lean();
    res.json(list.map(toBookingDoc));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.get('/approved-dates', async (req, res) => {
  try {
    const list = await Booking.find({ status: 'Approved' }).lean();
    const dates = list.map((b) => (b.date || '').slice(0, 10)).filter(Boolean);
    res.json(dates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch approved dates' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, startTime, endTime, name, notes } = req.body || {};
    const dateStr = typeof date === 'string' ? date.slice(0, 10) : date;
    if (!dateStr || !name) return res.status(400).json({ error: 'Date and name required' });
    if (dateStr < todayStr()) return res.status(400).json({ error: 'Past dates cannot be booked.' });
    const bookings = await Booking.find({}).lean();
    if (hasApprovedBookingOnDate(bookings, dateStr, null)) {
      return res.status(400).json({ error: 'This date is already approved. The day is fully booked.' });
    }
    const newBooking = {
      id: 'B' + Date.now(),
      date: dateStr,
      startTime: startTime || '',
      endTime: endTime || '',
      name,
      notes: notes || '',
      status: 'Pending',
      createdDate: new Date(),
    };
    if (conflictsWithSameDay(newBooking, bookings, null)) {
      return res.status(400).json({
        error: 'This day already has a booking within 3 hours of the requested time. Please choose a time at least 3 hours apart.',
      });
    }
    const created = await Booking.create(newBooking);
    res.status(201).json(toBookingDoc(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create booking' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const booking = await Booking.findOne({ id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (updates.status !== undefined) {
      if (!['Approved', 'Rejected'].includes(updates.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      booking.status = updates.status;
    }
    if (updates.date !== undefined) {
      const dateStr = String(updates.date).slice(0, 10);
      if (dateStr < todayStr()) return res.status(400).json({ error: 'Past dates cannot be booked.' });
      const bookings = await Booking.find({}).lean();
      if (hasApprovedBookingOnDate(bookings, dateStr, id)) {
        return res.status(400).json({ error: 'This date is already approved. The day is fully booked.' });
      }
      const wouldBe = {
        id,
        date: dateStr,
        startTime: updates.startTime !== undefined ? updates.startTime : booking.startTime,
        endTime: updates.endTime !== undefined ? updates.endTime : booking.endTime,
        status: booking.status,
      };
      if (conflictsWithSameDay(wouldBe, bookings, id)) {
        return res.status(400).json({
          error: 'This day already has a booking within 3 hours of this time. Bookings must be at least 3 hours apart.',
        });
      }
      booking.date = dateStr;
    }
    if (updates.startTime !== undefined) booking.startTime = updates.startTime;
    if (updates.endTime !== undefined) booking.endTime = updates.endTime;
    await booking.save();
    res.json(toBookingDoc(booking));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update booking' });
  }
});

module.exports = router;
