import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IVendorProductImage {
  url: string;
  publicId: string; // Cloudinary public ID
  alt?: string;
  isPrimary?: boolean;
}

export interface IVendorProduct extends Document {
  productId: mongoose.Types.ObjectId; // Reference to Product
  vendorId: mongoose.Types.ObjectId; // Reference to Vendor
  price: number;
  comparePrice?: number; // Original price for discount calculation
  stock: number;
  reservedStock: number; // Stock reserved in pending orders
  soldQuantity: number; // Total quantity sold
  sku: string; // Vendor-specific SKU
  status: 'pending' | 'approved' | 'rejected';
  isFeatured: boolean;
  discountPercentage?: number;
  shippingInfo?: {
    freeShipping: boolean;
  };
  discountAmount?: number; // Virtual field
  isOnSale?: boolean; // Virtual field
  createdAt: Date;
  updatedAt: Date;
}

// Extend the model interface to include aggregatePaginate
interface IVendorProductModel extends Model<IVendorProduct> {
  aggregatePaginate: typeof aggregatePaginate;
}

const VendorProductSchema: Schema = new Schema({
  productId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true
  },
  vendorId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  comparePrice: { 
    type: Number,
    min: 0
  },
  stock: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0
  },
  soldQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  sku: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9-]+$/, 'SKU must contain only uppercase letters, numbers, and hyphens'],
    default: function() {
      return `SKU-${Date.now()}`;
    }
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  shippingInfo: {
    freeShipping: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Add pagination plugins
VendorProductSchema.plugin(mongoosePaginate);
VendorProductSchema.plugin(aggregatePaginate);

// Compound index for productId and vendorId
VendorProductSchema.index({ productId: 1, vendorId: 1 }, { unique: true });
VendorProductSchema.index({ sku: 1 });
VendorProductSchema.index({ status: 1 });
VendorProductSchema.index({ vendorId: 1, isFeatured: 1 });

// Virtual for calculating discount amount
VendorProductSchema.virtual('discountAmount').get(function(this: IVendorProduct) {
  if (this.comparePrice && this.comparePrice > this.price) {
    return this.comparePrice - this.price;
  }
  return 0;
});

// Virtual for checking if product is on sale
VendorProductSchema.virtual('isOnSale').get(function(this: IVendorProduct) {
  return this.comparePrice && this.comparePrice > this.price;
});

// Ensure virtual fields are serialized
VendorProductSchema.set('toJSON', {
  virtuals: true
});

const VendorProduct = mongoose.model<IVendorProduct, IVendorProductModel>('VendorProduct', VendorProductSchema);
export default VendorProduct;