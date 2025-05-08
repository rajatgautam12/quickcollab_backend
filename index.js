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
  transports: ['websocket', 'polling'],
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
const commentRoutes = require('./routes/comments');
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

  // Join user-specific room
  socket.on('joinUser', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${socket.id} joined user:${userId}`);
  });

  socket.on('joinBoard', (boardId) => {
    socket.join(`board:${boardId}`);
    console.log(`User ${socket.id} joined board:${boardId}`);
  });

  socket.on('joinTask', (taskId) => {
    socket.join(`task:${taskId}`);
    console.log(`User ${socket.id} joined task:${taskId}`);
  });

  socket.on('leaveBoard', (boardId) => {
    socket.leave(`board:${boardId}`);
    console.log(`User ${socket.id} left board:${boardId}`);
  });

  socket.on('leaveTask', (taskId) => {
    socket.leave(`task:${taskId}`);
    console.log(`User ${socket.id} left task:${taskId}`);
  });

  socket.on('createTask', async (task) => {
    try {
      console.log('Received createTask:', task);
      const newTask = await require('./models/Task').create({
        title: task.title,
        description: task.description,
        status: task.status,
        board: task.board,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        assignedTo: task.assignedTo || null,
        _id: task._id,
      });
      const populatedTask = await require('./models/Task').findById(newTask._id).populate('assignedTo', 'email name');
      console.log('Emitting taskCreated to board:', task.board);
      io.to(`board:${task.board}`).emit('taskCreated', populatedTask);
      if (newTask.assignedTo) {
        io.to(`user:${newTask.assignedTo}`).emit('taskAssigned', populatedTask);
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  });

  socket.on('updateTask', async (task) => {
    try {
      console.log('Received updateTask:', task);
      const updatedTask = await require('./models/Task').findByIdAndUpdate(
        task._id,
        { status: task.status },
        { new: true }
      ).populate('assignedTo', 'email name');
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

  socket.on('editTask', async (task) => {
    try {
      console.log('Received editTask:', task);
      const updatedTask = await require('./models/Task').findByIdAndUpdate(
        task._id,
        {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          assignedTo: task.assignedTo || null,
        },
        { new: true }
      ).populate('assignedTo', 'email name');
      if (updatedTask) {
        console.log('Emitting taskEdited to board:', updatedTask.board);
        io.to(`board:${updatedTask.board}`).emit('taskEdited', updatedTask);
        if (updatedTask.assignedTo) {
          io.to(`user:${updatedTask.assignedTo}`).emit('taskAssigned', updatedTask);
        }
      } else {
        console.error('Task not found:', task._id);
      }
    } catch (err) {
      console.error('Error editing task:', err);
    }
  });

  socket.on('deleteTask', async (taskId, boardId) => {
    try {
      console.log('Received deleteTask:', taskId);
      const deletedTask = await require('./models/Task').findByIdAndDelete(taskId);
      if (deletedTask) {
        console.log('Emitting taskDeleted to board:', boardId);
        io.to(`board:${boardId}`).emit('taskDeleted', taskId);
      } else {
        console.error('Task not found:', taskId);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  });

  socket.on('commentAdded', async (comment) => {
    try {
      console.log('Received commentAdded:', comment);
      const newComment = await require('./models/Comment').create({
        content: comment.content,
        task: comment.task,
        user: comment.user,
        createdAt: comment.createdAt || new Date(),
      });
      const populatedComment = await require('./models/Comment').findById(newComment._id).populate('user', 'email name');
      console.log('Emitting commentAdded to task:', comment.task);
      io.to(`task:${comment.task}`).emit('commentAdded', populatedComment);
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  });

  socket.on('inviteSent', async (data) => {
    try {
      console.log('Received inviteSent:', data);
      io.to(`user:${data.userId}`).emit('inviteSent', data);
    } catch (err) {
      console.error('Error emitting inviteSent:', err);
    }
  });

  socket.on('collaboratorAdded', async (collaborator, boardId) => {
    try {
      console.log('Received collaboratorAdded:', collaborator);
      io.to(`board:${boardId}`).emit('collaboratorAdded', collaborator);
    } catch (err) {
      console.error('Error emitting collaboratorAdded:', err);
    }
  });

  socket.on('taskAssigned', async (task) => {
    try {
      console.log('Received taskAssigned:', task);
      const updatedTask = await require('./models/Task').findById(task._id).populate('assignedTo', 'email name');
      if (updatedTask && task.assignedTo) {
        io.to(`user:${task.assignedTo}`).emit('taskAssigned', updatedTask);
      }
      io.to(`board:${task.board}`).emit('taskAssigned', updatedTask);
    } catch (err) {
      console.error('Error emitting taskAssigned:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO user disconnected:', socket.id);
  });
});

// const PORT = process.env.PORT || 5000;
server.listen(5000, () => {
  console.log(`Server running on port 5000`);
});