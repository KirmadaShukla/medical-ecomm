import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Order from '../models/order';
import VendorProduct from '../models/vendorProduct';
import Cart from '../models/cart';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { catchAsyncError, AppError } from '../utils/errorHandler';

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

// Create order
export const createOrder = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { vendorProducts, shippingAddress, billingAddress, notes, paymentMethod = 'razorpay' } = req.body;
    const userId = req.user?._id;
    
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('User not authenticated', 401));
    }
     
    if (!vendorProducts || !Array.isArray(vendorProducts) || vendorProducts.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Vendor products are required', 400));
    }
    
    if (!shippingAddress) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Shipping address is required', 400));
    }
    
    // Validate payment method
    const validPaymentMethods = ['razorpay', 'cod', 'wallet'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Invalid payment method', 400));
    }
    
    // Validate that all vendor product IDs are valid ObjectIds
    const vendorProductIds = vendorProducts.map((item: any) => item.vendorProductId);
    
    // Check if any vendor product ID is invalid
    for (const id of vendorProductIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(`Invalid vendor product ID: ${id}. All IDs must be valid MongoDB ObjectIds.`, 400));
      }
    }
    
    const vendorProductDocs = await VendorProduct.find({
      _id: { $in: vendorProductIds },
      status: 'approved',
      isActive: true
    }).populate('productId');
    
    const orderItems: any[] = [];
    let totalAmount = 0;
    let shippingPrice = 0;
    
    for (const item of vendorProducts) {
      const vendorProductDoc = vendorProductDocs.find(
        (vp: any) => vp._id.toString() === item.vendorProductId
      );
      
      if (!vendorProductDoc) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(`Vendor product with ID ${item.vendorProductId} not found or not available`, 404));
      }
      
      if (vendorProductDoc.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(`Insufficient stock for ${(vendorProductDoc as any).productId.name}. Available: ${vendorProductDoc.stock}`, 400));
      }
      
      // Calculate item total
      const itemTotal = vendorProductDoc.price * item.quantity;
      totalAmount += itemTotal;
      
      // Calculate shipping cost
      const itemShipping = vendorProductDoc.shippingPrice * item.quantity;
      shippingPrice += itemShipping;
      
      // Add to order items
      orderItems.push({
        vendorProductId: vendorProductDoc._id,
        quantity: item.quantity,
        price: vendorProductDoc.price
      });
    }
    
    // Calculate grand total
    const grandTotal = totalAmount + shippingPrice;
    
    // Set payment status based on payment method
    let paymentStatus = 'pending';
    if (paymentMethod === 'cod') {
      paymentStatus = 'pending'; // COD orders are pending until delivery
    }
    
    // Create order in database
    const order = new Order({
      user: userId,
      vendorProducts: orderItems,
      totalAmount,
      shippingPrice,
      grandTotal,
      paymentMethod,
      paymentStatus,
      orderStatus: 'pending',
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes
    });
    
    await order.save({ session });
    
    // For Razorpay payments, create Razorpay order
    let razorpayOrderId = null;
    if (paymentMethod === 'razorpay') {
      const razorpayOrder = await razorpay.orders.create({
        amount: grandTotal * 100, // Razorpay expects amount in paise (using grandTotal)
        currency: 'INR',
        receipt: (order._id as mongoose.Types.ObjectId).toString(),
        notes: {
          orderId: (order._id as mongoose.Types.ObjectId).toString()
        }
      });
      
      // Update order with Razorpay order ID
      razorpayOrderId = razorpayOrder.id;
      order.razorpayOrderId = razorpayOrderId;
      await order.save({ session });
    }
    
    // For COD orders, reduce stock immediately since payment will be collected on delivery
    if (paymentMethod === 'cod') {
      for (const item of order.vendorProducts) {
        await VendorProduct.findByIdAndUpdate(
          item.vendorProductId,
          { $inc: { stock: -item.quantity } },
          { session }
        );
      }
      await order.save({ session });
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Determine razorpayOrderId to return (null for non-Razorpay payments)
    if (paymentMethod === 'razorpay') {
      razorpayOrderId = order.razorpayOrderId;
    }
    
    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: order._id,
        totalAmount: order.totalAmount,
        shippingPrice: order.shippingPrice,
        grandTotal: order.grandTotal,
        razorpayOrderId: razorpayOrderId
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error creating order:', error);
    return next(new AppError('Error creating order', 500));
  }
});

// Verify Razorpay payment
export const verifyPayment = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Implement retry logic for handling MongoDB Write Conflicts
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
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
          return next(new AppError('Payment verification failed', 400));
        }
      }
      
      // Find order by Razorpay order ID
      const order = await Order.findOne({ razorpayOrderId }).session(session);
      
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Order not found', 404));
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
      
      // Clear user's cart after successful payment
      try {
        await Cart.findOneAndDelete({ userId: order.user });
      } catch (cartError) {
        console.warn('Failed to clear user cart after payment:', cartError);
        // Don't fail the payment verification if cart clearing fails
      }
      
      res.status(200).json({
        message: 'Payment verified successfully',
        order: {
          _id: order._id,
          paymentStatus: order.paymentStatus
        }
      });
      return; // Success, exit the retry loop
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      
      // Check if this is a write conflict error that should be retried
      if (error.code === 112 && retries < MAX_RETRIES - 1) { // WriteConflict error
        retries++;
        console.warn(`Write conflict occurred, retrying... (${retries}/${MAX_RETRIES})`);
        // Add a small delay before retrying to reduce contention
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
        continue;
      }
      
      console.error('Error verifying payment:', error);
      return next(new AppError('Error verifying payment', 500));
    }
  }
});

// Get user orders
export const getUserOrders = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?._id;
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }
  
  const { page = 1, limit = 10 } = req.query;
  
  const options = {
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    sort: { createdAt: -1 }
  };
  
  const result = await (Order as any).paginate({ user: userId }, options);
  
  res.status(200).json(result);
});

// Get order by ID
export const getOrderById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?._id;
  const { id } = req.params;
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }
  
  const order = await Order.findOne({ 
    _id: id, 
    user: userId 
  }).populate({
    path: 'vendorProducts.vendorProductId',
    populate: {
      path: 'productId vendorId',
      select: 'name images businessName'
    }
  });
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  res.status(200).json(order);
});

// Cancel order
export const cancelOrder = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('User not authenticated', 401));
    }
    
    // Find order
    const order = await Order.findOne({ 
      _id: id, 
      user: userId 
    }).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Order not found', 404));
    }
    
    // Check if order can be cancelled
    if (order.orderStatus === 'delivered' || order.orderStatus === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Order cannot be cancelled', 400));
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
        orderStatus: order.orderStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error cancelling order:', error);
    return next(new AppError('Error cancelling order', 500));
  }
});

// ==================== ADMIN ORDER MANAGEMENT ====================

// Get orders for admin (admin-specific vendor products)
export const getAdminOrders = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const adminId = req.user?._id;
  const { page = 1, limit = 10, status, paymentStatus } = req.query;
  
  if (!adminId) {
    return next(new AppError('Admin not authenticated', 401));
  }
  
  // Build match conditions
  const matchConditions: any = {};
  
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
          name: 1,
          images: 1
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
});

// Get order by ID (admin)
export const getAdminOrderById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  
  const order = await Order.findById(id).populate({
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
    return next(new AppError('Order not found', 404));
  }
  
  res.status(200).json(order);
});

// Update order status (admin)
export const updateOrderStatusAdmin = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Invalid status. Must be one of: pending, confirmed, processing, shipped, delivered, cancelled', 400));
    }
    
    // Find order
    const order = await Order.findById(id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Order not found', 404));
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
        orderStatus: order.orderStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating order status:', error);
    return next(new AppError('Error updating order status', 500));
  }
});

// ==================== VENDOR ORDER MANAGEMENT ====================

// Get orders for a specific vendor
export const getVendorOrders = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorId = req.user?._id;
  
  if (!vendorId) {
    return next(new AppError('Vendor not authenticated', 401));
  }
  
  const { page = 1, limit = 10, status } = req.query;
  
  // Build match conditions
  const matchConditions: any = {};
  
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
    // Lookup product details from the Product collection
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
          productName: '$productDetails.name',
          productImage: { $arrayElemAt: ['$productDetails.images.url', 0] }
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
});

// Get specific order for vendor
export const getVendorOrderById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorId = req.user?._id;
  const { id } = req.params;
  
  if (!vendorId) {
    return next(new AppError('Vendor not authenticated', 401));
  }
  
  const order = await Order.findOne({ 
    _id: id
  });
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Check if any vendor product in the order belongs to the vendor
  const vendorProductIds = order.vendorProducts.map(item => item.vendorProductId);
  const vendorProducts = await VendorProduct.find({
    _id: { $in: vendorProductIds },
    vendorId: vendorId
  });
  
  if (vendorProducts.length === 0) {
    return next(new AppError('Order not found or you do not have permission to view it', 404));
  }
  
  res.status(200).json(order);
});

// Update order status by vendor
export const updateOrderStatusVendor = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const vendorId = req.user?._id;
    const { id } = req.params;
    const { status } = req.body;
    
    if (!vendorId) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Vendor not authenticated', 401));
    }
    console.log("OrderId",id)
    // Validate status
    const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Invalid status. Must be one of: confirmed, processing, shipped, delivered', 400));
    }
    
    // Find order
    const order = await Order.findOne({ 
      _id: id
    }).session(session);
    
    // Check if order exists
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Order not found', 404));
    }
    
    // Check if any vendor product in the order belongs to the vendor
    const vendorProductIds = order.vendorProducts.map(item => item.vendorProductId);
    const vendorProducts = await VendorProduct.find({
      _id: { $in: vendorProductIds },
      vendorId: vendorId
    }).session(session);
    
    if (vendorProducts.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Order not found or you do not have permission to update it', 404));
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
      return next(new AppError(`Cannot change status from ${currentStatus} to ${status}`, 400));
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
        orderStatus: order.orderStatus
      }
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating order status:', error);
    return next(new AppError('Error updating order status', 500));
  }
});