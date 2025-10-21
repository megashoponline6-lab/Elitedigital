// models/Account.js
const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  platform: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Platform',
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  slots: {
    type: Number,
    required: true,
    min: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

AccountSchema.index({ platform: 1, email: 1 });

module.exports = mongoose.model('Account', AccountSchema);
