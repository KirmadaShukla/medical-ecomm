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
  stock: number;
  sku: string; // Vendor-specific SKU
  status: 'pending' | 'approved' | 'rejected';
  isFeatured: boolean;
  isActive: boolean;
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
VendorProductSchema.index({ globalProductId: 1 });

const VendorProduct = mongoose.model<IVendorProduct, IVendorProductModel>('VendorProduct', VendorProductSchema);
export default VendorProduct;