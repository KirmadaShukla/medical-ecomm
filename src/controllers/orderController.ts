import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/order';
import VendorProduct from '../models/vendorProduct';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Dummy payment implementation for now
let razorpay: any;

// Initialize Razorpay only if keys are present
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  // Dummy implementation for development
  console.warn('Razorpay keys not found. Using dummy payment implementation.');
  razorpay = {
    orders: {
      create: async (options: any) => {
        // Return a fake Razorpay order object
        return {
          id: `rzp_dummy_${Date.now()}`,
          amount: options.amount,
          currency: options.currency,
          receipt: options.receipt
        };
      }
    }
  };
}

// Generate unique order ID
const generateOrderId = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${timestamp}-${random}`;
};

// Create order
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { vendorProducts, shippingAddress, billingAddress, notes } = req.body;
    const userId = req.user?._id;
    
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
     
    if (!vendorProducts || !Array.isArray(vendorProducts) || vendorProducts.length === 0) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ message: 'Vendor products are required' });
      return;
    }
    
    if (!shippingAddress) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ message: 'Shipping address is required' });
      return;
    }
    
    const vendorProductIds = vendorProducts.map((item: any) => item.vendorProductId);
    const vendorProductDocs = await VendorProduct.find({
      _id: { $in: vendorProductIds },
      status: 'approved',
      isActive: true
    }).populate('productId');
    
    const orderItems: any[] = [];
    let totalAmount = 0;
    
    for (const item of vendorProducts) {
      const vendorProductDoc = vendorProductDocs.find(
        (vp: any) => vp._id.toString() === item.vendorProductId
      );
      
      if (!vendorProductDoc) {
        await session.abortTransaction();
        session.endSession();
        res.status(404).json({ 
          message: `Vendor product with ID ${item.vendorProductId} not found or not available` 
        });
        return;
      }
      
      if (vendorProductDoc.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ 
          message: `Insufficient stock for ${(vendorProductDoc as any).productId.name}. Available: ${vendorProductDoc.stock}` 
        });
        return;
      }
      
      // Calculate item total
      const itemTotal = vendorProductDoc.price * item.quantity;
      totalAmount += itemTotal;
      
      // Add to order items
      orderItems.push({
        vendorProductId: vendorProductDoc._id,
        quantity: item.quantity,
        price: vendorProductDoc.price,
        productName: (vendorProductDoc as any).productId.name,
        productImage: (vendorProductDoc as any).productId.images[0]?.url || ''
      });
    }
    
    // Create order in database
    const order = new Order({
      orderId: generateOrderId(),
      user: userId,
      vendorProducts: orderItems,
      totalAmount,
      paymentMethod: 'razorpay',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes
    });
    
    await order.save({ session });
    
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: order.orderId,
      notes: {
        orderId: (order._id as mongoose.Types.ObjectId).toString()
      }
    });
    
    // Update order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        razorpayOrderId: order.razorpayOrderId
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error creating order:', error);
    res.status(500).json({ 
      message: 'Error creating order', 
      error: error.message || error 
    });
  }
};

// Verify Razorpay payment
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    
    // If using dummy implementation, skip signature verification
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.warn('Using dummy payment verification');
    } else {
      // Verify payment signature
      const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '');
      shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
      const digest = shasum.digest('hex');
      
      if (digest !== razorpaySignature) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: 'Payment verification failed' });
        return;
      }
    }
    
    // Find order by Razorpay order ID
    const order = await Order.findOne({ razorpayOrderId }).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    // Update order payment status
    order.paymentStatus = 'completed';
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    
    // Update stock quantities for vendor products
    for (const item of order.vendorProducts) {
      await VendorProduct.findByIdAndUpdate(
        item.vendorProductId,
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }
    
    await order.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      message: 'Payment verified successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error verifying payment:', error);
    res.status(500).json({ 
      message: 'Error verifying payment', 
      error: error.message || error 
    });
  }
};

// Get user orders
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    const { page = 1, limit = 10 } = req.query;
    
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sort: { createdAt: -1 }
    };
    
    const result = await (Order as any).paginate({ user: userId }, options);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ 
      message: 'Error fetching orders', 
      error: error.message || error 
    });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { orderId } = req.params;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId 
    }).populate({
      path: 'vendorProducts.vendorProductId',
      populate: {
        path: 'productId vendorId',
        select: 'name images businessName'
      }
    });
    
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    res.status(200).json(order);
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({ 
      message: 'Error fetching order', 
      error: error.message || error 
    });
  }
};

// Cancel order
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user?._id;
    const { orderId } = req.params;
    
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    // Find order
    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId 
    }).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    // Check if order can be cancelled
    if (order.orderStatus === 'delivered' || order.orderStatus === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ message: 'Order cannot be cancelled' });
      return;
    }
    
    // Update order status
    order.orderStatus = 'cancelled';
    
    // If payment was completed, initiate refund
    if (order.paymentStatus === 'completed') {
      order.paymentStatus = 'refunded';
      // In a real application, you would initiate a refund through Razorpay here
    }
    
    await order.save({ session });
    
    // Restore stock quantities for vendor products
    if ((order as any).paymentStatus === 'completed') {
      for (const item of order.vendorProducts) {
        await VendorProduct.findByIdAndUpdate(
          item.vendorProductId,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      message: 'Error cancelling order', 
      error: error.message || error 
    });
  }
};

// ==================== ADMIN ORDER MANAGEMENT ====================

// Get orders for admin (admin-specific vendor products)
export const getAdminOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?._id;
    const { page = 1, limit = 10, status, paymentStatus } = req.query;
    
    if (!adminId) {
      res.status(401).json({ message: 'Admin not authenticated' });
      return;
    }
    
    // Build match conditions
    const matchConditions: any = {
      'vendorProducts.vendorId': adminId
    };
    
    if (status) {
      matchConditions.orderStatus = status;
    }
    
    if (paymentStatus) {
      matchConditions.paymentStatus = paymentStatus;
    }
    
    const pipeline: any[] = [
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      {
        $unwind: {
          path: '$customerDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: 'vendorProducts.vendorProductId',
          foreignField: '_id',
          as: 'vendorProductDetails'
        }
      },
      {
        $unwind: '$vendorProductDetails'
      },
      {
        $match: {
          'vendorProductDetails.vendorId': adminId
        }
      },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorProductDetails.vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'vendorProductDetails.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          orderId: 1,
          totalAmount: 1,
          paymentMethod: 1,
          paymentStatus: 1,
          orderStatus: 1,
          shippingAddress: 1,
          createdAt: 1,
          updatedAt: 1,
          vendorProducts: 1,
          customerDetails: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1
          },
          vendorDetails: {
            _id: 1,
            businessName: 1
          },
          productDetails: {
            _id: 1,
            name: 1
          }
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Order.aggregate(pipeline);
    const result = await (Order.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ 
      message: 'Error fetching orders', 
      error: error.message || error 
    });
  }
};

// Get order by ID (admin)
export const getAdminOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId).populate({
      path: 'vendorProducts.vendorProductId',
      populate: {
        path: 'productId vendorId',
        select: 'name images businessName'
      }
    }).populate({
      path: 'user',
      select: 'firstName lastName email phone'
    });
    
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    res.status(200).json(order);
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({ 
      message: 'Error fetching order', 
      error: error.message || error 
    });
  }
};

// Update order status (admin)
export const updateOrderStatusAdmin = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ 
        message: 'Invalid status. Must be one of: pending, confirmed, processing, shipped, delivered, cancelled' 
      });
      return;
    }
    
    // Find order
    const order = await Order.findById(orderId).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    // Update order status
    order.orderStatus = status as any;
    await order.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      message: 'Order status updated successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      message: 'Error updating order status', 
      error: error.message || error 
    });
  }
};

// ==================== VENDOR ORDER MANAGEMENT ====================

// Get orders for a specific vendor
export const getVendorOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorId = req.user?._id;
    
    if (!vendorId) {
      res.status(401).json({ message: 'Vendor not authenticated' });
      return;
    }
    
    const { page = 1, limit = 10, status } = req.query;
    
    // Build match conditions
    const matchConditions: any = {
      'vendorProducts.vendorId': vendorId
    };
    
    if (status) {
      matchConditions.orderStatus = status;
    }
    
    const pipeline: any[] = [
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: 'vendorProducts.vendorProductId',
          foreignField: '_id',
          as: 'vendorProductDetails'
        }
      },
      {
        $unwind: '$vendorProductDetails'
      },
      {
        $match: {
          'vendorProductDetails.vendorId': vendorId
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      {
        $unwind: {
          path: '$customerDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          orderId: 1,
          totalAmount: 1,
          paymentMethod: 1,
          paymentStatus: 1,
          orderStatus: 1,
          shippingAddress: 1,
          createdAt: 1,
          updatedAt: 1,
          vendorProductDetails: {
            _id: 1,
            productId: 1,
            price: 1,
            quantity: '$vendorProducts.quantity',
            productName: 1,
            productImage: 1
          },
          customerDetails: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1
          }
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Order.aggregate(pipeline);
    const result = await (Order.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ 
      message: 'Error fetching orders', 
      error: error.message || error 
    });
  }
};

// Get specific order for vendor
export const getVendorOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorId = req.user?._id;
    const { orderId } = req.params;
    
    if (!vendorId) {
      res.status(401).json({ message: 'Vendor not authenticated' });
      return;
    }
    
    const order = await Order.findOne({ 
      _id: orderId,
      'vendorProducts.vendorId': vendorId
    }).populate({
      path: 'vendorProducts.vendorProductId',
      match: { vendorId: vendorId },
      populate: {
        path: 'productId',
        select: 'name images'
      }
    }).populate({
      path: 'user',
      select: 'firstName lastName email phone'
    });
    
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    res.status(200).json(order);
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({ 
      message: 'Error fetching order', 
      error: error.message || error 
    });
  }
};

// Update order status by vendor
export const updateOrderStatusVendor = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const vendorId = req.user?._id;
    const { orderId } = req.params;
    const { status } = req.body;
    
    if (!vendorId) {
      await session.abortTransaction();
      session.endSession();
      res.status(401).json({ message: 'Vendor not authenticated' });
      return;
    }
    
    // Validate status
    const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ 
        message: 'Invalid status. Must be one of: confirmed, processing, shipped, delivered' 
      });
      return;
    }
    
    // Find order
    const order = await Order.findOne({ 
      _id: orderId,
      'vendorProducts.vendorId': vendorId
    }).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    // Check if status transition is valid
    const currentStatus = order.orderStatus;
    const validTransitions: any = {
      'pending': ['confirmed'],
      'confirmed': ['processing'],
      'processing': ['shipped'],
      'shipped': ['delivered']
    };
    
    if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ 
        message: `Cannot change status from ${currentStatus} to ${status}` 
      });
      return;
    }
    
    // Update order status
    order.orderStatus = status as any;
    await order.save({ session });
    
    // If order is confirmed, reduce stock
    if (status === 'confirmed') {
      for (const item of order.vendorProducts) {
        // Only update stock for products belonging to this vendor
        const vendorProduct = await VendorProduct.findOne({
          _id: item.vendorProductId,
          vendorId: vendorId
        }).session(session);
        
        if (vendorProduct) {
          // Reduce stock
          vendorProduct.stock -= item.quantity;
          await vendorProduct.save({ session });
        }
      }
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      message: 'Order status updated successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      message: 'Error updating order status', 
      error: error.message || error 
    });
  }
};