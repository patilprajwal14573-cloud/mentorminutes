const mongoose = require('mongoose');

const carryHistorySchema = new mongoose.Schema(
  {
    carriedAt: {
      type: Date,
      default: Date.now,
    },
    fromSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    toSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    reason: {
      type: String,
      default: 'Unfinished action carried forward from previous session',
    },
  },
  { _id: false }
);

const actionItemSchema = new mongoose.Schema(
  {
    relationship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MentoringRelationship',
      required: true,
      index: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Action item title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedToRole: {
      type: String,
      enum: ['mentor', 'learner'],
      default: 'learner',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    completedAt: {
      type: Date,
    },
    carried: {
      type: Boolean,
      default: false,
      index: true,
    },
    carriedForwardFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActionItem',
      default: null,
    },
    originalSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
    },
    carryCount: {
      type: Number,
      default: 0,
    },
    carryHistory: [carryHistorySchema],
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

actionItemSchema.index({ relationship: 1, status: 1, carried: 1 });
actionItemSchema.index({ session: 1, status: 1 });
actionItemSchema.index(
  { session: 1, carriedForwardFrom: 1 },
  {
    unique: true,
    partialFilterExpression: { carriedForwardFrom: { $type: 'objectId' } },
  }
);

module.exports = mongoose.model('ActionItem', actionItemSchema);
