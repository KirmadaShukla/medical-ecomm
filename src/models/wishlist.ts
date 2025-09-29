import mongoose, { Schema, Document } from 'mongoose';

interface IWishlistItem {
  vendorProductId: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema: Schema<IWishlist> = new Schema({
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
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
WishlistSchema.index({ userId: 1 });

// Ensure no duplicate items in wishlist
WishlistSchema.pre('save', async function(next) {
  const vendorProductIds = this.items.map(item => item.vendorProductId.toString());
  const uniqueIds = [...new Set(vendorProductIds)];
  
  if (vendorProductIds.length !== uniqueIds.length) {
    return next(new Error('Duplicate items are not allowed in wishlist'));
  }
  
  next();
});

export default mongoose.model<IWishlist>('Wishlist', WishlistSchema);