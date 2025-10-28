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
  try {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('Razorpay instance created successfully');
    console.log('Razorpay key ID:', process.env.RAZORPAY_KEY_ID);
    console.log('Is test environment:', process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_'));
    console.log('Razorpay instance keys:', Object.keys(razorpay));
    if (razorpay.payments) {
      console.log('Razorpay payments methods:', Object.keys(razorpay.payments));
    }
  } catch (error: any) {
    console.error('Error creating Razorpay instance:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack
    });
    razorpay = null;
  }
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
    },
    payments: {
      refund: async (options: any) => {
        // Return a fake Razorpay refund object
        console.log('Dummy refund called with options:', options);
        return {
          id: `rfnd_dummy_${Date.now()}`,
          payment_id: options.payment_id,
          amount: options.amount || 1000, // Default to 1000 paise (10 INR) if not specified
          currency: 'INR',
          status: 'processed'
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
      const itemShipping = vendorProductDoc.shippingPrice
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
    
    // Store original payment status before updating
    const originalPaymentStatus = order.paymentStatus;
    
    // Update order status
    order.orderStatus = 'cancelled';
    
    // Log order details for debugging
    console.log('Order details for cancellation:', {
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      razorpayPaymentId: order.razorpayPaymentId,
      razorpayOrderId: order.razorpayOrderId
    });
    
    // If payment was completed, process refund automatically
    if (order.paymentStatus === 'completed') {
      // If using dummy implementation, skip actual refund
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.warn('Using dummy refund implementation');
        order.paymentStatus = 'refunded';
      } else {
        // Process refund through Razorpay
        try {
          // Check if order has Razorpay payment ID
          if (!order.razorpayPaymentId) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Order does not have a valid Razorpay payment ID', 400));
          }
          
          // Check if razorpay payments object exists
          if (!razorpay || !razorpay.payments) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Razorpay payments service not available', 500));
          }
          
          // Check if refund function exists
          if (typeof razorpay.payments.refund !== 'function') {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Razorpay refund function not available', 500));
          }
          
          // Check if payment ID format is valid (should start with "pay_")
          if (!order.razorpayPaymentId.startsWith('pay_')) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Invalid Razorpay payment ID format', 400));
          }
          
          console.log('Processing refund for order:', {
            orderId: order._id,
            paymentId: order.razorpayPaymentId,
            paymentStatus: order.paymentStatus
          });
          
          const refundData: any = {
            payment_id: order.razorpayPaymentId
          };
          
          console.log('Refund data being sent:', refundData);
          
          // Process refund through Razorpay
          const refund = await razorpay.payments.refund(refundData);
          
          console.log('Refund response received:', refund);
          
          // Update order payment status and store refund ID
          order.paymentStatus = 'refunded';
          order.razorpayRefundId = refund.id;
        } catch (refundError: any) {
          console.error('Detailed refund error:', {
            error: refundError,
            message: refundError?.message,
            description: refundError?.description,
            errorObj: refundError?.error,
            stack: refundError?.stack,
            statusCode: refundError?.statusCode
          });
          
          // For test environments, we might want to allow cancellation to proceed even if refund fails
          // Check if we're using test keys
          const isTestEnvironment = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_');
          
          if (isTestEnvironment) {
            // In test environment, log the error but allow cancellation to proceed
            console.warn('Refund failed in test environment, but allowing cancellation to proceed:', refundError.message || 'Unknown error');
            order.paymentStatus = 'refunded'; // Still mark as refunded for consistency
          } else {
            // In production, fail the cancellation if refund fails
            await session.abortTransaction();
            session.endSession();
            
            // Try to extract a meaningful error message
            let errorMessage = 'Unknown error occurred during refund processing';
            if (refundError) {
              if (typeof refundError === 'string') {
                errorMessage = refundError;
              } else if (refundError.message) {
                errorMessage = refundError.message;
              } else if (refundError.description) {
                errorMessage = refundError.description;
              } else if (refundError.error) {
                if (typeof refundError.error === 'string') {
                  errorMessage = refundError.error;
                } else if (refundError.error.description) {
                  errorMessage = refundError.error.description;
                } else if (refundError.error.reason) {
                  errorMessage = refundError.error.reason;
                } else {
                  errorMessage = JSON.stringify(refundError.error);
                }
              } else if (refundError.statusCode) {
                if (refundError.statusCode === 404) {
                  errorMessage = 'Payment not found in Razorpay system. The payment ID may be invalid, from a different environment, or too old.';
                } else if (refundError.statusCode === 400) {
                  errorMessage = 'Bad request to Razorpay. The payment may have already been refunded or cannot be refunded.';
                } else if (refundError.statusCode === 401) {
                  errorMessage = 'Unauthorized access to Razorpay API. Please check your Razorpay API keys.';
                } else {
                  errorMessage = `Razorpay API error (Status: ${refundError.statusCode})`;
                }
              } else {
                errorMessage = JSON.stringify(refundError);
              }
            }
            
            return next(new AppError(`Error processing refund: ${errorMessage}`, 500));
          }
        }
      }
    }
    
    await order.save({ session });
    
    // Restore stock quantities for vendor products if payment was completed
    if (originalPaymentStatus === 'completed') {
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
      message: 'Order cancelled and refunded successfully',
      order: {
        _id: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus
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