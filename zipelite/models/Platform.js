// models/Platform.js
const mongoose = require('mongoose');

const PlatformSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  logoUrl: {
    type: String,
    default: ''
  },
  available: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Platform', PlatformSchema);
