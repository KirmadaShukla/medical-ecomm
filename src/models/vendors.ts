import mongoose, { Schema, Document } from 'mongoose';

export interface IVendor extends Document {
  userId: mongoose.Types.ObjectId; // Reference to the User document
  businessName: string;
  businessLicense: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  taxId?: string;
  bankAccount?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  commissionRate: number; // Commission percentage for this vendor
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rating?: number;
  totalSales?: number;
  totalProducts?: number;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
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
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  taxId: { 
    type: String 
  },
  bankAccount: {
    accountNumber: { type: String },
    routingNumber: { type: String },
    bankName: { type: String }
  },
  commissionRate: { 
    type: Number, 
    default: 10, // Default 10% commission
    min: 0,
    max: 100
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  rating: { 
    type: Number,
    min: 0,
    max: 5
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

// Index for better query performance
VendorSchema.index({ businessName: 1 });
VendorSchema.index({ status: 1 });
VendorSchema.index({ rating: -1 });

export default mongoose.model<IVendor>('Vendor', VendorSchema);