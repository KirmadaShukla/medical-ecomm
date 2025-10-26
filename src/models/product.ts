import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IProductImage {
  url: string;
  publicId: string; // Cloudinary public ID
  alt?: string;
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  category: mongoose.Types.ObjectId; // Reference to Category model
  brand?: mongoose.Types.ObjectId; // Reference to Brand model
  globalProduct?: mongoose.Types.ObjectId; // Reference to GlobalProduct model
  images: IProductImage[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface for products with populated brand and category details
export interface IProductPopulated extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: mongoose.Types.ObjectId;
  brand?: mongoose.Types.ObjectId;
  globalProduct?: mongoose.Types.ObjectId;
  images: IProductImage[];
  createdAt: Date;
  updatedAt: Date;
  categoryDetails?: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  brandDetails?: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
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
  }]
}, {
  timestamps: true
});

// Add pagination plugins
ProductSchema.plugin(mongoosePaginate);
ProductSchema.plugin(aggregatePaginate);

// Index for better query performance
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });

ProductSchema.index({ globalProduct: 1 });

const Product = mongoose.model<IProduct, IProductModel>('Product', ProductSchema);
export default Product;