import mongoose, { Schema, Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

// Subcategory schema (embedded within Category)
interface ISubCategory {
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

const SubCategorySchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
});

export interface ICategory extends Document {
  name: string;
  description?: string;
  image?: {
    url: string;
    publicId: string;
  };
  subCategories: Omit<ISubCategory, 'image'>[];
  parentId?: mongoose.Types.ObjectId; // For hierarchical categories
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100,
    unique: true // Add unique constraint to prevent duplicate category names
  },
  description: { 
    type: String,
    maxlength: 500
  },
  image: {
    url: { type: String },
    publicId: { type: String }
  },
  subCategories: {
    type: [SubCategorySchema],
    default: []
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
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
CategorySchema.plugin(mongoosePaginate);
CategorySchema.plugin(aggregatePaginate);

// Index for better query performance
CategorySchema.index({ name: 'text' });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ name: 1 }, { unique: true }); // Explicit unique index on name

export default mongoose.model<ICategory>('Category', CategorySchema);