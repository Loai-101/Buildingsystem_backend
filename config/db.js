const mongoose = require('mongoose');

function getMongoUri() {
  let uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to Buildingsystem_backend/.env');
  }
  // USE_DEV_DATABASE=true in .env.local (local only, not on server) → use buildingsystem_dev so localhost and deploy stay separate
  const useDevDb = process.env.USE_DEV_DATABASE === 'true' || process.env.USE_DEV_DATABASE === '1';
  if (useDevDb && uri.includes('.mongodb.net/')) {
    const match = uri.match(/^(.+\.mongodb\.net\/)([^/?]+)(\?.*)?$/);
    if (match) {
      const base = match[1];
      const dbName = match[2];
      const query = match[3] || '';
      const devDb = dbName.replace(/_dev$/, '') + '_dev';
      uri = base + devDb + query;
      console.log('[DB] Using dev database (USE_DEV_DATABASE):', devDb, '- local changes stay separate from deploy.');
    }
  }
  if (uri.startsWith('mongodb+srv://') && !uri.includes('?')) {
    return `${uri}?retryWrites=true&w=majority`;
  }
  return uri;
}

async function connectDB() {
  const uri = getMongoUri();
  await mongoose.connect(uri);
  console.log('MongoDB connected to database:', mongoose.connection.db?.databaseName || 'unknown');
}

module.exports = connectDB;
