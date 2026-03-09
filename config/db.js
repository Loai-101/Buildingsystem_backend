const mongoose = require('mongoose');

function getMongoUri() {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to Buildingsystem_backend/.env');
  }
  // Atlas often needs these options; add if not already present
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
