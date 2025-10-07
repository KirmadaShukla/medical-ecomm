import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface IBannerImage {
  url: string;
  publicId: string; // Cloudinary public ID
  alt?: string;
}

export interface IBanner extends Document {
  title: string;
  description?: string;
  image: IBannerImage;
  link?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema: Schema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      trim: true
    }
  },
  link: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true
});

// Add indexes
BannerSchema.index({ sortOrder: 1 });
BannerSchema.index({ isActive: 1 });

// Add pagination plugin
BannerSchema.plugin(mongoosePaginate);

const Banner = mongoose.model<IBanner>('Banner', BannerSchema);
export default Banner;