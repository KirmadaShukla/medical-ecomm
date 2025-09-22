import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  email: string;
  password: string;
  role: string; // Add role field
  department: string;
  lastLoginAt?: Date;
  isActive: boolean;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema({
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: { 
    type: String, 
    default: 'admin' // Set default role
  },
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

// Hash password before saving
AdminSchema.pre<IAdmin>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
AdminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for better query performance
AdminSchema.index({ department: 1 });
AdminSchema.index({ isActive: 1 });
AdminSchema.index({ email: 1 }); // Add index for email

export default mongoose.model<IAdmin>('Admin', AdminSchema);