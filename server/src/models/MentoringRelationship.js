const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: [true, 'Mentoring topic is required'],
      trim: true,
      maxlength: [150, 'Topic cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    meetingFrequency: {
      type: String,
      enum: ['Weekly', 'Bi-weekly', 'Monthly', 'As-needed'],
      default: 'Weekly',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Composite index to check active relationship uniqueness
relationshipSchema.index({ mentor: 1, learner: 1 });

module.exports = mongoose.model('MentoringRelationship', relationshipSchema);
