const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'https://quickcollab-rajats-projects-456ae623.vercel.app',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.set('io', io); // Store io instance for use in routes

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

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join board room
  socket.on('joinBoard', (boardId) => {
    socket.join(`board:${boardId}`);
    console.log(`User ${socket.id} joined board:${boardId}`);
  });

  // Leave board room
  socket.on('leaveBoard', (boardId) => {
    socket.leave(`board:${boardId}`);
    console.log(`User ${socket.id} left board:${boardId}`);
  });

  // Handle task updates (e.g., status change)
  socket.on('updateTask', async (task) => {
    try {
      const updatedTask = await require('./models/Task').findByIdAndUpdate(
        task._id,
        { status: task.status },
        { new: true }
      );
      if (updatedTask) {
        io.to(`board:${updatedTask.board}`).emit('taskUpdated', updatedTask);
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});