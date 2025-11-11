import mongoose, { Schema, Document, Types } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface ISubCategory extends Document {
  name: string;
  description?: string;
  category: Types.ObjectId; // Reference to the parent category
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubCategorySchema: Schema = new Schema({
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
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
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
SubCategorySchema.plugin(mongoosePaginate);
SubCategorySchema.plugin(aggregatePaginate);

// Index for better query performance
SubCategorySchema.index({ name: 'text' });
SubCategorySchema.index({ category: 1 });
SubCategorySchema.index({ isActive: 1 });

export default mongoose.model<ISubCategory>('SubCategory', SubCategorySchema);