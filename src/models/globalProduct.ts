import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IGlobalProduct extends Document {
  name: string;
  productIds: mongoose.Types.ObjectId[]; // Array of product IDs that belong to this global product
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Extend the model interface to include pagination
interface IGlobalProductModel extends Model<IGlobalProduct> {
  aggregatePaginate: typeof aggregatePaginate;
}

const GlobalProductSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200,
    unique: true
  },
  productIds: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Product'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add pagination plugins
GlobalProductSchema.plugin(mongoosePaginate);
GlobalProductSchema.plugin(aggregatePaginate);

// Index for better query performance
GlobalProductSchema.index({ name: 1 });
GlobalProductSchema.index({ isActive: 1 });

const GlobalProduct = mongoose.model<IGlobalProduct, IGlobalProductModel>('GlobalProduct', GlobalProductSchema);
export default GlobalProduct;