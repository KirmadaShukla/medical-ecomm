import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorPayment extends Document {
  vendor: mongoose.Types.ObjectId; // Reference to Vendor
  amount: number; // Payment amount
  periodStart: Date; // Start of the payment period
  periodEnd: Date; // End of the payment period
  paymentDate: Date; // When the payment was made
  status: 'pending' | 'completed' | 'failed'; // Payment status
  transactionId?: string; // Transaction ID from payment gateway
  notes?: string; // Additional notes
  createdAt: Date;
  updatedAt: Date;
}

const VendorPaymentSchema: Schema = new Schema({
  vendor: { 
    type: Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  periodStart: { 
    type: Date, 
    required: true
  },
  periodEnd: { 
    type: Date, 
    required: true
  },
  paymentDate: { 
    type: Date,
    default: Date.now
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  transactionId: { 
    type: String 
  },
  notes: { 
    type: String 
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
VendorPaymentSchema.index({ vendor: 1 });
VendorPaymentSchema.index({ status: 1 });
VendorPaymentSchema.index({ paymentDate: -1 });
VendorPaymentSchema.index({ periodStart: 1, periodEnd: 1 });

export default mongoose.model<IVendorPayment>('VendorPayment', VendorPaymentSchema);