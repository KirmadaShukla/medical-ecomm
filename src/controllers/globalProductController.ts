import { Request, Response, NextFunction } from 'express';
import { catchAsyncError, AppError } from '../utils/errorHandler';
import GlobalProduct from '../models/globalProduct';
import Product from '../models/product';
import mongoose from 'mongoose';


// ==================== GLOBAL PRODUCT CRUD ====================

// Get all global products with pagination
export const getGlobalProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Get pagination parameters from query
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  
  // Build filter object
  const filter: any = { isActive: true };
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Build the aggregation pipeline
  const pipeline = [
    { $match: filter },
    {
      $project: {
        _id: 1,
        name: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ];
  
  // Use aggregate pagination
  const options = {
    page,
    limit
  };
  
  const aggregate = GlobalProduct.aggregate(pipeline);
  const result = await (GlobalProduct.aggregatePaginate as any)(aggregate, options);
  
  res.status(200).json(result);
});

// Get global product by ID
export const getGlobalProductById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const globalProduct = await GlobalProduct.findById(req.params.id);
  
  if (!globalProduct) {
    return next(new AppError('Global product not found', 404));
  }
  
  res.status(200).json(globalProduct);
});

// Create a new global product (admin only)
export const createGlobalProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Create global product
  const globalProduct = new GlobalProduct({
    name: req.body.name,
    productIds: req.body.productIds || [],
    isActive: req.body.isActive !== undefined ? req.body.isActive : true
  });
  
  await globalProduct.save();
  
  res.status(201).json(globalProduct);
});

// Update global product (admin only)
export const updateGlobalProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const globalProduct = await GlobalProduct.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!globalProduct) {
    return next(new AppError('Global product not found', 404));
  }
  
  res.status(200).json(globalProduct);
});

// Delete global product (admin only)
export const deleteGlobalProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const globalProduct = await GlobalProduct.findByIdAndDelete(req.params.id);
  
  if (!globalProduct) {
    return next(new AppError('Global product not found', 404));
  }
  
  res.status(200).json({ message: 'Global product deleted successfully' });
});

// Add product to global product
export const addProductToGlobalProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { globalProductId, productId } = req.body;
  
  // Check if global product exists
  const globalProduct = await GlobalProduct.findById(globalProductId);
  if (!globalProduct) {
    return next(new AppError('Global product not found', 404));
  }
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }
  
  // Check if product is already in the global product
  if (globalProduct.productIds.includes(productId)) {
    return next(new AppError('Product is already associated with this global product', 400));
  }
  
  // Add product to global product
  globalProduct.productIds.push(productId);
  await globalProduct.save();
  
  // Update product with global product reference
  product.globalProduct = globalProductId as any;
  await product.save();
  
  res.status(200).json({ 
    message: 'Product added to global product successfully',
    globalProduct
  });
});

// Remove product from global product
export const removeProductFromGlobalProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { globalProductId, productId } = req.body;
  
  // Check if global product exists
  const globalProduct = await GlobalProduct.findById(globalProductId);
  if (!globalProduct) {
    return next(new AppError('Global product not found', 404));
  }
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }
  
  // Check if product is in the global product
  if (!globalProduct.productIds.includes(productId)) {
    return next(new AppError('Product is not associated with this global product', 400));
  }
  
  // Remove product from global product
  globalProduct.productIds = globalProduct.productIds.filter(
    (id: mongoose.Types.ObjectId) => id.toString() !== productId.toString()
  );
  await globalProduct.save();
  
  // Remove global product reference from product
  product.globalProduct = undefined;
  await product.save();
  
  res.status(200).json({ 
    message: 'Product removed from global product successfully',
    globalProduct
  });
});

// Get all products associated with a global product
export const getProductsByGlobalProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { globalProductId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Check if global product exists
  const globalProduct = await GlobalProduct.findById(globalProductId);
  if (!globalProduct) {
    return next(new AppError('Global product not found', 404));
  }
  
  // Build the aggregation pipeline
  const pipeline = [
    {
      $match: {
        _id: { $in: globalProduct.productIds }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    {
      $unwind: {
        path: '$categoryDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brandDetails'
      }
    },
    {
      $unwind: {
        path: '$brandDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        images: 1,
        tags: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        categoryDetails: {
          _id: 1,
          name: 1
        },
        brandDetails: {
          _id: 1,
          name: 1
        }
      }
    }
  ];
  
  // Use aggregate pagination
  const options = {
    page,
    limit
  };
  
  const aggregate = Product.aggregate(pipeline);
  const result = await (Product.aggregatePaginate as any)(aggregate, options);
  
  res.status(200).json(result);
});