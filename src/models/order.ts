import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IOrderItem {
  vendorProductId: mongoose.Types.ObjectId; // Reference to VendorProduct
  quantity: number;
  price: number; // Price at the time of order
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId; // Reference to User
  vendorProducts: IOrderItem[];
  totalAmount: number;
  shippingPrice: number;
  grandTotal: number;
  paymentMethod: 'razorpay' | 'cod' | 'wallet';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  razorpayRefundId?: string; // Add this field for storing refund ID
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  };
  billingAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extend the model interface to include aggregatePaginate
interface IOrderModel extends Model<IOrder> {
  aggregatePaginate: typeof aggregatePaginate;
}

const OrderSchema: Schema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorProducts: [{
    vendorProductId: {
      type: Schema.Types.ObjectId,
      ref: 'VendorProduct',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod'],
    default: 'razorpay'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  razorpayPaymentId: {
    type: String
  },
  razorpayOrderId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },
  razorpayRefundId: {
    type: String
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  shippingAddress: {
    name: {
      type: String,
      required: true
    },
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  billingAddress: {
    name: {
      type: String
    },
    street: {
      type: String
    },
    city: {
      type: String
    },
    state: {
      type: String
    },
    zipCode: {
      type: String
    },
    country: {
      type: String
    },
    phone: {
      type: String
    }
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Add indexes
OrderSchema.index({ user: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });

// Add pagination plugins
OrderSchema.plugin(mongoosePaginate);
OrderSchema.plugin(aggregatePaginate);

const Order = mongoose.model<IOrder, IOrderModel>('Order', OrderSchema);
export default Order;