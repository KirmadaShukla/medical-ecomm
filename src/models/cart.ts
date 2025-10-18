import mongoose, { Schema, Document } from 'mongoose';

interface ICartItem {
  _id?: mongoose.Types.ObjectId;
  vendorProductId: mongoose.Types.ObjectId;
  quantity: number;
  addedAt: Date;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
  totalAmount: number;
  shippingPrice: number;
  grandTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

const CartSchema: Schema<ICart> = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  items: [{
    _id: false,
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
  }],
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
CartSchema.index({ userId: 1 });

// Calculate total amount before saving
CartSchema.pre('save', async function(next) {
  if (!this.isModified('items')) {
    return next();
  }

  let total = 0;
  let shippingTotal = 0;
  
  // Calculate total based on items and their prices
  for (const item of this.items) {
    const vendorProduct = await mongoose.model('VendorProduct').findById(item.vendorProductId);
    if (vendorProduct) {
      total += vendorProduct.price * item.quantity;
      shippingTotal += vendorProduct.shippingPrice;
    }
  }
  
  this.totalAmount = total;
  this.shippingPrice = shippingTotal;
  this.grandTotal = total + shippingTotal;
  next();
});

export default mongoose.model<ICart>('Cart', CartSchema);