const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    relationship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MentoringRelationship',
      required: true,
      index: true,
    },
    sessionNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Session title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Session scheduled date is required'],
      default: Date.now,
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: [15, 'Duration must be at least 15 minutes'],
      max: [480, 'Duration cannot exceed 480 minutes'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    agenda: {
      type: String,
      trim: true,
      default: '',
    },
    topicsDiscussed: {
      type: String,
      trim: true,
      default: '',
    },
    keyTakeaways: {
      type: String,
      trim: true,
      default: '',
    },
    sharedSummary: {
      type: String,
      trim: true,
      default: '',
    },
    learnerFeedback: {
      type: String,
      trim: true,
      default: '',
    },
    mentorPrivateNotes: {
      type: String,
      trim: true,
      default: '',
    },
    nextSessionDate: {
      type: Date,
    },
    carriedActionsCount: {
      type: Number,
      default: 0,
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

sessionSchema.index({ relationship: 1, sessionNumber: 1 }, { unique: true });
sessionSchema.index({ relationship: 1, scheduledDate: -1 });

module.exports = mongoose.model('Session', sessionSchema);
