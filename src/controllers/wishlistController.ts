import { Request, Response, NextFunction } from 'express';
import Wishlist, { IWishlist } from '../models/wishlist';
import VendorProduct from '../models/vendorProduct';
import { catchAsyncError, AppError } from '../utils/errorHandler';

// Get user's wishlist
export const getWishlist = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const wishlist = await Wishlist.findOne({ userId: req.user._id }).populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  if (!wishlist) {
    // Create an empty wishlist if it doesn't exist
    const newWishlist = await Wishlist.create({
      userId: req.user._id,
      items: []
    });
    
    res.status(200).json({
      success: true,
      data: newWishlist
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: wishlist
  });
});

// Add item to wishlist
export const addItemToWishlist = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorProductId } = req.body;

  // Validate input
  if (!vendorProductId) {
    return next(new AppError('Please provide vendorProductId', 400));
  }

  // Check if vendor product exists
  const vendorProduct = await VendorProduct.findById(vendorProductId);
  if (!vendorProduct) {
    return next(new AppError('Vendor product not found', 404));
  }

  // Find or create wishlist for user
  let wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    wishlist = new Wishlist({
      userId: req.user._id,
      items: []
    });
  }

  // Check if item already exists in wishlist
  const existingItemIndex = wishlist.items.findIndex(
    item => item.vendorProductId.toString() === vendorProductId
  );

  if (existingItemIndex > -1) {
    return next(new AppError('Item already exists in wishlist', 400));
  }

  // Add new item to wishlist
  wishlist.items.push({
    vendorProductId,
    addedAt: new Date()
  });

  // Save wishlist
  await wishlist.save();

  // Populate the wishlist with product details
  await wishlist.populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  res.status(200).json({
    success: true,
    data: wishlist
  });
});

// Remove item from wishlist
export const removeItemFromWishlist = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { itemId } = req.params;

  // Find wishlist for user
  const wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    return next(new AppError('Wishlist not found', 404));
  }

  // Find item in wishlist
  const itemIndex = wishlist.items.findIndex(
    item => item._id && item._id.toString() === itemId
  );

  if (itemIndex === -1) {
    return next(new AppError('Item not found in wishlist', 404));
  }

  // Remove item from wishlist
  wishlist.items.splice(itemIndex, 1);

  // Save wishlist
  await wishlist.save();

  // Populate the wishlist with product details
  await wishlist.populate({
    path: 'items.vendorProductId',
    populate: [
      { path: 'productId', select: 'name description' },
      { path: 'vendorId', select: 'businessName' }
    ]
  });

  res.status(200).json({
    success: true,
    data: wishlist
  });
});

// Clear wishlist
export const clearWishlist = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    return next(new AppError('Wishlist not found', 404));
  }

  wishlist.items = [];
  await wishlist.save();

  res.status(200).json({
    success: true,
    message: 'Wishlist cleared successfully'
  });
});

// Check if item exists in wishlist
export const isItemInWishlist = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorProductId } = req.params;

  // Find wishlist for user
  const wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    res.status(200).json({
      success: true,
      data: {
        isInWishlist: false
      }
    });
    return;
  }

  // Check if item exists in wishlist
  const itemExists = wishlist.items.some(
    item => item.vendorProductId.toString() === vendorProductId
  );

  res.status(200).json({
    success: true,
    data: {
      isInWishlist: itemExists
    }
  });
});