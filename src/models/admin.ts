import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  department: string;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema({
  department: { 
    type: String, 
    required: true,
    trim: true
  },
  lastLoginAt: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

// Index for better query performance
AdminSchema.index({ department: 1 });
AdminSchema.index({ isActive: 1 });

export default mongoose.model<IAdmin>('Admin', AdminSchema);