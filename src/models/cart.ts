import mongoose, { Schema, Document } from 'mongoose';

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: {
    vendorProductId: mongoose.Types.ObjectId;
    quantity: number;
    addedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const CartSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  items: [{
    vendorProductId: { 
      type: Schema.Types.ObjectId, 
      ref: 'VendorProduct',
      required: true
    },
    quantity: { 
      type: Number, 
      required: true,
      min: 1
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
CartSchema.index({ userId: 1 });

export default mongoose.model<ICart>('Cart', CartSchema);