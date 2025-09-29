import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IProductImage {
  url: string;
  publicId: string; // Cloudinary public ID
  alt?: string;
  isPrimary?: boolean;
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  category: mongoose.Types.ObjectId; // Reference to Category model
  subCategory?: mongoose.Types.ObjectId; // Reference to Category model (optional)
  brand?: mongoose.Types.ObjectId; // Reference to Brand model
  globalProduct?: mongoose.Types.ObjectId; // Reference to GlobalProduct model
  images: IProductImage[];
  tags?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Extend the model interface to include aggregatePaginate
interface IProductModel extends Model<IProduct> {
  aggregatePaginate: typeof aggregatePaginate;
}

const ProductSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String,
    maxlength: 2000
  },
  category: { 
    type: Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true
  },
  subCategory: { 
    type: Schema.Types.ObjectId, 
    ref: 'Category'
  },
  brand: { 
    type: Schema.Types.ObjectId, 
    ref: 'Brand'
  },
  globalProduct: { 
    type: Schema.Types.ObjectId, 
    ref: 'GlobalProduct'
  },
  images: [{ 
    url: { 
      type: String, 
      required: true
    },
    publicId: { 
      type: String, 
      required: true 
    },
    alt: { type: String },
    isPrimary: { type: Boolean, default: false }
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add pagination plugins
ProductSchema.plugin(mongoosePaginate);
ProductSchema.plugin(aggregatePaginate);

// Index for better query performance
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ globalProduct: 1 });

const Product = mongoose.model<IProduct, IProductModel>('Product', ProductSchema);
export default Product;