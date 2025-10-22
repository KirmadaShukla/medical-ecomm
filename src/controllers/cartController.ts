import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Cart, { ICart } from '../models/cart';
import VendorProduct from '../models/vendorProduct';
import { catchAsyncError, AppError } from '../utils/errorHandler';

// Helper function to calculate cart totals dynamically
const calculateCartTotals = async (cart: ICart) => {
  let totalAmount = 0;
  let shippingPrice = 0;
  
  // Calculate totals based on current vendor product prices
  for (const item of cart.items) {
    const vendorProduct = await VendorProduct.findById(item.vendorProductId);
    if (vendorProduct) {
      totalAmount += vendorProduct.price * item.quantity;
      shippingPrice += vendorProduct.shippingPrice;
    }
  }
  
  const grandTotal = totalAmount + shippingPrice;
  
  return {
    totalAmount,
    shippingPrice,
    grandTotal
  };
};

// Get user's cart
export const getCart = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description images' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  if (!cart) {
    // Create an empty cart if it doesn't exist
    const newCart = await Cart.create({
      userId: req.user._id,
      items: []
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...newCart.toObject(),
        totalAmount: 0,
        shippingPrice: 0,
        grandTotal: 0
      }
    });
    return;
  }

  // Calculate totals dynamically
  const { totalAmount, shippingPrice, grandTotal } = await calculateCartTotals(cart);

  res.status(200).json({
    success: true,
    data: {
      ...cart.toObject(),
      totalAmount,
      shippingPrice,
      grandTotal
    }
  });
});

// Add item to cart
export const addItemToCart = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorProductId, quantity } = req.body;

  // Validate input
  if (!vendorProductId || !quantity) {
    return next(new AppError('Please provide vendorProductId and quantity', 400));
  }

  // Validate that vendorProductId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(vendorProductId)) {
    return next(new AppError('Invalid vendor product ID. Must be a valid MongoDB ObjectId.', 400));
  }

  // Check if vendor product exists and is in stock
  const vendorProduct = await VendorProduct.findById(vendorProductId);
  if (!vendorProduct) {
    return next(new AppError('Vendor product not found', 404));
  }

  if (vendorProduct.stock < quantity) {
    return next(new AppError(`Only ${vendorProduct.stock} items available in stock`, 400));
  }

  // Find or create cart for user
  let cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    cart = new Cart({
      userId: req.user._id,
      items: []
    });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.vendorProductId.toString() === vendorProductId
  );

  if (existingItemIndex > -1) {
    // Update quantity if item exists
    cart.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    cart.items.push({
      vendorProductId,
      quantity,
      addedAt: new Date()
    });
  }

  // Save cart (without pre-save hook for calculating totals)
  await cart.save();

  // Populate the cart with product details
  await cart.populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description images' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  // Calculate totals dynamically
  const { totalAmount, shippingPrice, grandTotal } = await calculateCartTotals(cart);

  res.status(200).json({
    success: true,
    data: {
      ...cart.toObject(),
      totalAmount,
      shippingPrice,
      grandTotal
    }
  });
});

// Update item quantity in cart
export const updateCartItem = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorProductId } = req.params;

  // Validate that vendorProductId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(vendorProductId)) {
    return next(new AppError('Invalid vendor product ID. Must be a valid MongoDB ObjectId.', 400));
  }
  const { quantity } = req.body;

  // Validate input
  if (!quantity) {
    return next(new AppError('Please provide quantity', 400));
  }

  if (quantity < 1) {
    return next(new AppError('Quantity must be at least 1', 400));
  }

  // Find cart for user
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  // Find item in cart using vendorProductId
  const itemIndex = cart.items.findIndex(
    item => item.vendorProductId.toString() === vendorProductId
  );

  if (itemIndex === -1) {
    return next(new AppError('Item not found in cart', 404));
  }

  // Check if vendor product exists and has enough stock
  const vendorProduct = await VendorProduct.findById(cart.items[itemIndex].vendorProductId);
  if (!vendorProduct) {
    return next(new AppError('Vendor product not found', 404));
  }

  if (vendorProduct.stock < quantity) {
    return next(new AppError(`Only ${vendorProduct.stock} items available in stock`, 400));
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;

  // Save cart (without pre-save hook for calculating totals)
  await cart.save();

  // Populate the cart with product details
  await cart.populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description images' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  // Calculate totals dynamically
  const { totalAmount, shippingPrice, grandTotal } = await calculateCartTotals(cart);

  res.status(200).json({
    success: true,
    data: {
      ...cart.toObject(),
      totalAmount,
      shippingPrice,
      grandTotal
    }
  });
});

// Remove item from cart
export const removeItemFromCart = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorProductId } = req.params;

  // Validate that vendorProductId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(vendorProductId)) {
    return next(new AppError('Invalid vendor product ID. Must be a valid MongoDB ObjectId.', 400));
  }

  // Find cart for user
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  // Find item in cart using vendorProductId
  const itemIndex = cart.items.findIndex(
    item => item.vendorProductId.toString() === vendorProductId
  );

  if (itemIndex === -1) {
    return next(new AppError('Item not found in cart', 404));
  }

  // Remove item from cart
  cart.items.splice(itemIndex, 1);

  // Save cart (without pre-save hook for calculating totals)
  await cart.save();

  // Populate the cart with product details
  await cart.populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description images' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  // Calculate totals dynamically
  const { totalAmount, shippingPrice, grandTotal } = await calculateCartTotals(cart);

  res.status(200).json({
    success: true,
    data: {
      ...cart.toObject(),
      totalAmount,
      shippingPrice,
      grandTotal
    }
  });
});

// Clear cart
export const clearCart = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  cart.items = [];
  await cart.save();

  res.status(200).json({
    success: true,
    data: {
      ...cart.toObject(),
      totalAmount: 0,
      shippingPrice: 0,
      grandTotal: 0
    },
    message: 'Cart cleared successfully'
  });
});