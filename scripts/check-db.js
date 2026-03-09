/**
 * Verify MongoDB connection and accounts data (run from Buildingsystem_backend: node scripts/check-db.js)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const AccountRecord = require('../models/AccountRecord');
const ExtraYear = require('../models/ExtraYear');

async function check() {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }
  const fullUri = uri.startsWith('mongodb+srv://') && !uri.includes('?')
    ? `${uri}?retryWrites=true&w=majority`
    : uri;
  try {
    await mongoose.connect(fullUri);
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log('MongoDB connected:', dbName);

    const recordCount = await AccountRecord.countDocuments();
    const years = await AccountRecord.distinct('year');
    const extra = await ExtraYear.find({}).lean();
    const extraYears = (extra || []).map((e) => e.year);

    console.log('AccountRecord collection:', AccountRecord.collection.name);
    console.log('Record count:', recordCount);
    console.log('Years from records:', (years || []).sort((a, b) => b - a).slice(0, 10).join(', '));
    console.log('Extra years:', extraYears.length, extraYears.slice(0, 5).join(', '));
    if (recordCount === 0 && years.length === 0) {
      console.log('\nNo account records in DB. Add records via the app or ensure collection name is "accountrecords".');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

check();
