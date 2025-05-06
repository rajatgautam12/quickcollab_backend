const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://quickcollab-rajats-projects-456ae623.vercel.app',
  'https://quickcollab-jbc1isuuo-rajats-projects-456ae623.vercel.app'
].filter(Boolean);

const io = new Server(server, {
  cors: {
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
  },
  transports: ['websocket', 'polling'], // Ensure WebSocket support
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}));
app.use(express.json());
app.set('io', io);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comment');
app.use('/auth', authRoutes);
app.use('/boards', boardRoutes);
app.use('/tasks', taskRoutes);
app.use('/comments', commentRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('QuickCollab Backend');
});

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('Socket.IO user connected:', socket.id, 'Transport:', socket.conn.transport.name);

  socket.on('joinBoard', (boardId) => {
    socket.join(`board:${boardId}`);
    console.log(`User ${socket.id} joined board:${boardId}`);
  });

  socket.on('leaveBoard', (boardId) => {
    socket.leave(`board:${boardId}`);
    console.log(`User ${socket.id} left board:${boardId}`);
  });

  socket.on('updateTask', async (task) => {
    try {
      console.log('Received updateTask:', task);
      const updatedTask = await require('./models/Task').findByIdAndUpdate(
        task._id,
        { status: task.status },
        { new: true }
      );
      if (updatedTask) {
        console.log('Emitting taskUpdated to board:', updatedTask.board);
        io.to(`board:${updatedTask.board}`).emit('taskUpdated', updatedTask);
      } else {
        console.error('Task not found:', task._id);
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO user disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});