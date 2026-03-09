// Load .env from backend directory (dotenv is more reliable for URIs with = and special chars)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.MONGODB_URI) {
  console.warn('MONGODB_URI not set. Create Buildingsystem_backend/.env with MONGODB_URI=your_mongodb_connection_string');
} else {
  console.log('Using MONGODB_URI from .env (database:', (process.env.MONGODB_URI || '').split('/').pop().split('?')[0] || 'unknown', ')');
}

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { seedDefaultAdmin } = require('./scripts/seedAdmin');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const bookingsRoutes = require('./routes/bookings');
const maintenanceRoutes = require('./routes/maintenance');
const accountsRoutes = require('./routes/accounts');

const app = express();

// Allow frontend origins (Vite dev, production, or proxy)
const fromEnv = (v) => (v ? v.split(',').map((u) => u.trim().replace(/\/$/, '')).filter(Boolean) : []);
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...fromEnv(process.env.ALLOWED_ORIGINS),
  ...fromEnv(process.env.FRONTEND_URL),
];
const normalizeOrigin = (o) => (o ? o.replace(/\/$/, '') : o);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes(normalizeOrigin(origin))) return cb(null, true);
    return cb(null, true); // allow same-origin when proxied (no origin)
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/accounts', accountsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    await seedDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API base: http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
