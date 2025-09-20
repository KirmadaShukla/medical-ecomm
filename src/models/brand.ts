import mongoose, { Schema, Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IBrandImage {
  url: string;
  publicId: string; // Cloudinary public ID
  alt?: string;
  isPrimary?: boolean;
}

export interface IBrand extends Document {
  name: string;
  slug: string;
  description?: string;
  logo?: IBrandImage; // Brand logo with Cloudinary info
  website?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain only lowercase letters, numbers, and hyphens']
  },
  description: { 
    type: String,
    maxlength: 500
  },
  logo: { 
    url: { 
      type: String
    },
    publicId: { 
      type: String
    },
    alt: { type: String },
    isPrimary: { type: Boolean, default: true }
  },
  website: { 
    type: String,
    match: [/^https?:\/\/.+$/, 'Please enter a valid URL']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add pagination plugins
BrandSchema.plugin(mongoosePaginate);
BrandSchema.plugin(aggregatePaginate);

// Index for better query performance
BrandSchema.index({ name: 'text' });
BrandSchema.index({ slug: 1 });
BrandSchema.index({ isActive: 1 });

export default mongoose.model<IBrand>('Brand', BrandSchema);