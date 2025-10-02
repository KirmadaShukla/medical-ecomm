import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IVendor extends Document {
  businessName: string;
  businessLicense: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  password: string; // Vendor's own password
  role: string; // Add role field
  taxId?: string;
  bankAccount?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  totalSales?: number;
  totalProducts?: number;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema: Schema = new Schema({
  businessName: { 
    type: String, 
    required: true,
    trim: true
  },
  businessLicense: { 
    type: String, 
    required: true 
  },
  businessAddress: { 
    type: String, 
    required: true 
  },
  businessPhone: { 
    type: String, 
    required: true 
  },
  businessEmail: { 
    type: String, 
    required: true,
    unique: true, // Make email unique
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
    default: 'vendor' // Set default role
  },
  taxId: { 
    type: String 
  },
  bankAccount: {
    accountNumber: { type: String },
    routingNumber: { type: String },
    bankName: { type: String }
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  totalSales: { 
    type: Number, 
    default: 0 
  },
  totalProducts: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: true
});

// Hash password before saving
VendorSchema.pre<IVendor>('save', async function(next) {
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
VendorSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for better query performance
VendorSchema.index({ businessName: 1 });
VendorSchema.index({ status: 1 });
VendorSchema.index({ rating: -1 });
VendorSchema.index({ businessEmail: 1 }); // Add index for email

export default mongoose.model<IVendor>('Vendor', VendorSchema);