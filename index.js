const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://quickcollab-rajats-projects-456ae623.vercel.app',
  'https://quickcollab-jbc1isuuo-rajats-projects-456ae623.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('CORS error: Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}));

app.use(express.json());

// MongoDB Connection (Singleton Pattern)
let mongooseConnection = null;

async function connectToMongoDB() {
  if (mongooseConnection) {
    return mongooseConnection;
  }

  try {
    mongooseConnection = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
    return mongooseConnection;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// Middleware to ensure MongoDB is connected
app.use(async (req, res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (err) {
    res.status(500).json({ message: 'Database connection error' });
  }
});

// Routes
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const invitationRoutes = require('./routes/invitations');

app.use('/auth', authRoutes);
app.use('/boards', boardRoutes);
app.use('/tasks', taskRoutes);
app.use('/comments', commentRoutes);
app.use('/invitations', invitationRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('QuickCollab Backend');
});

// Vercel Serverless Export
module.exports = app;
