import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IVendorProductImage {
  url: string;
  publicId: string; // Cloudinary public ID
  alt?: string;
}

export interface IVendorProduct extends Document {
  productId: mongoose.Types.ObjectId; // Reference to Product
  vendorId: mongoose.Types.ObjectId; // Reference to Vendor
  globalProductId?: mongoose.Types.ObjectId; // Reference to GlobalProduct
  price: number;
  discount: number; // Discount percentage (0-100)
  shippingPrice: number;
  totalPrice: number;
  stock: number;
  sku: string; // Vendor-specific SKU
  status: 'pending' | 'approved' | 'rejected';
  isFeatured: boolean;
  isActive: boolean;
  // Additional product tags
  isOnSale: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isLimitedEdition: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Extend the model interface to include aggregatePaginate
interface IVendorProductModel extends Model<IVendorProduct> {
  aggregatePaginate: typeof aggregatePaginate;
  paginate: typeof mongoosePaginate;
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
  globalProductId: { 
    type: Schema.Types.ObjectId, 
    ref: 'GlobalProduct'
  },
  price: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  discount: { 
    type: Number, 
    required: false,
    min: 0,
    max: 100,
    default: 0
  },
  shippingPrice: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  totalPrice: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  stock: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
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
  isActive: {
    type: Boolean,
    default: true
  },
  // Additional product tags
  isOnSale: {
    type: Boolean,
    default: false
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  isNewArrival: {
    type: Boolean,
    default: false
  },
  isLimitedEdition: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add a pre-save hook to calculate totalPrice based on price, discount, and shippingPrice
VendorProductSchema.pre<IVendorProduct>('save', function(next) {
  // Calculate discounted price
  const discountedPrice = this.price * (1 - (this.discount || 0) / 100);
  // Calculate total price (discounted price + shipping)
  this.totalPrice = Math.round((discountedPrice + this.shippingPrice) * 100) / 100;
  next();
});

// Add pagination plugins
VendorProductSchema.plugin(mongoosePaginate);
VendorProductSchema.plugin(aggregatePaginate);

// Compound index for productId and vendorId
VendorProductSchema.index({ productId: 1, vendorId: 1 }, { unique: true });
VendorProductSchema.index({ sku: 1 });
VendorProductSchema.index({ status: 1 });
VendorProductSchema.index({ vendorId: 1, isFeatured: 1 });
VendorProductSchema.index({ globalProductId: 1 });

const VendorProduct = mongoose.model<IVendorProduct, IVendorProductModel>('VendorProduct', VendorProductSchema);
export default VendorProduct;