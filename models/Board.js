const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['Owner', 'Member'],
      default: 'Member',
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Board', boardSchema);