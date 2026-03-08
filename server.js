// Load .env without requiring the dotenv package
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean) : []),
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
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
