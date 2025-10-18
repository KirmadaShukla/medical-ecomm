import { Request, Response, NextFunction } from 'express';
import { catchAsyncError, AppError } from '../utils/errorHandler';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';
import Category from '../models/category';
import Vendor from '../models/vendors';
import GlobalProduct from '../models/globalProduct';
import { generateVendorToken } from '../utils/tokenUtils';
import { uploadProductImages } from '../utils/cloudinary';

// ==================== VENDOR REGISTRATION ====================

// Register a new vendor
export const registerVendor = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    firstName,
    lastName,
    email,
    password,
    businessName,
    businessLicense,
    businessAddress,
    businessPhone,
    taxId,
    bankAccount
  } = req.body;
  
  // Basic validation
  if (!firstName || !lastName || !email || !password || !businessName || 
      !businessLicense || !businessAddress || !businessPhone) {
    return next(new AppError('Missing required fields: firstName, lastName, email, password, businessName, businessLicense, businessAddress, businessPhone', 400));
  }
  
  // Check if vendor with this email already exists
  const existingVendor = await Vendor.findOne({ businessEmail: email });
  if (existingVendor) {
    return next(new AppError('Vendor with this email already exists', 409));
  }
  
  // Create vendor profile
  const vendor = new Vendor({
    businessName,
    businessLicense,
    businessAddress,
    businessPhone,
    businessEmail: email,
    taxId,
    bankAccount,
    status: 'pending', // Default to pending for approval
    password, // Using the same password for vendor login
    firstName,
    lastName,
    role: 'vendor'
  });
  
  await vendor.save();
  
  // Generate vendor token (using vendor object but with IUser interface)
  const token = generateVendorToken(vendor as any); // Type assertion to bypass type checking
  
  // Remove password from output
  const vendorObj = vendor.toObject();
  // @ts-ignore
  delete vendorObj.password;
  
  res.status(201).json({
    message: 'Vendor registered successfully. Awaiting admin approval.',
    vendor: vendorObj,
    token
  });
});

// ==================== AUTHENTICATION ====================

// Vendor login
export const vendorLogin = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { businessEmail, password } = req.body;
  
  // Basic validation
  if (!businessEmail || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  // Find vendor user by email and select password
  const user = await Vendor.findOne({ businessEmail, role: 'vendor' }).select('+password');
  
  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }
  
  // Check password
  const isPasswordCorrect = await user.comparePassword(password);
  
  if (!isPasswordCorrect) {
    return next(new AppError('Invalid email or password', 401));
  }
  
      
  // Generate vendor token
  const token = generateVendorToken(user);
  
  // Remove password from output
  const userObj = user.toObject();
  // @ts-ignore
  delete userObj.password;
  
  res.status(200).json({
    user: userObj,
    token
  });
});

// Send vendor token
export const sendVendorToken = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }
  
  const token = authHeader.split(' ')[1];
  
  // Verify token
  const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  
  // Check if this is a vendor token
  if (decoded.role !== 'vendor') {
    return next(new AppError('Invalid token: Not a vendor token', 401));
  }
  
  // Find vendor in database
  const vendor = await Vendor.findById(decoded.id);
  if (!vendor || vendor.status !== 'approved') {
    // Check if vendor is pending approval
    if (vendor && vendor.status === 'pending') {
      return next(new AppError('Please wait for approval from admin side', 401));
    } else if (vendor && vendor.status === 'rejected') {
      return next(new AppError('Your vendor application has been rejected. Please contact support.', 401));
    } else if (vendor && vendor.status === 'suspended') {
      return next(new AppError('Your vendor account has been suspended. Please contact support.', 401));
    }
    return next(new AppError('Vendor not found or not approved', 401));
  }
  
  // Generate a new vendor token
  const newToken = generateVendorToken(vendor);
  
  res.status(200).json({
    token: newToken
  });
});

// Unified function to add products (both new and existing) - for vendors
export const addProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      productId, // If provided, it's an existing product
      name, 
      description, 
      category, 
      brand, 
      price, 
      shippingPrice = 0,
      stock, 
      sku, 
      globalProductId, 
      globalProductName,
      isFeatured,
      isActive
    } = req.body;
    
    let product;
    let processedImages: { url: string; publicId: string; alt?: string }[] = [];
    
    // Handle image uploads if files are provided
    if (req.files && req.files.images) {
      // Handle both single file and multiple files
      let filesArray = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      
      // Upload images to Cloudinary with vendorId and temporary productId
      processedImages = await uploadProductImages(filesArray, req.user?._id, 'temp');
    } else if (req.body.images) {
      // Handle existing image URLs
      const images = req.body.images;
      if (Array.isArray(images)) {
        processedImages = images.map((img: any) => {
          if (typeof img === 'string') {
            return {
              url: img,
              publicId: 'default_public_id',
              alt: name || 'Product image'
            };
          } else {
            return img;
          }
        });
      } else if (typeof images === 'string') {
        processedImages = [{
          url: images,
          publicId: 'default_public_id',
          alt: name || 'Product image'
        }];
      }
    }
    
    // Handle all 4 cases for global product and product association
    if (!productId && globalProductId && !globalProductName) {
      // Case 1: Global product ID exists but product ID doesn't exist
      // Create a new product and associate it with the existing global product
      const globalProduct = await GlobalProduct.findById(globalProductId).session(session);
      if (!globalProduct) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Global product not found', 404));
      }
      
      // Check if category exists and is active
      const categoryDoc = await Category.findById(category).session(session);
      if (!categoryDoc) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Category not found', 400));
      }
      
      if (!categoryDoc.isActive) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Cannot create product. Category is not active', 400));
      }
      
      // Create new product
      const productData = {
        name,
        description,
        category,
        brand,
        images: processedImages,
        isActive: true,
        globalProduct: globalProductId
      };
      
      product = new Product(productData);
      await product.save({ session });
      
      // Add product to global product
      const productIdStr = (product._id as mongoose.Types.ObjectId).toString();
      if (!globalProduct.productIds.map(id => id.toString()).includes(productIdStr)) {
        globalProduct.productIds.push(product._id as mongoose.Types.ObjectId);
        await globalProduct.save({ session });
      }
    } else if (productId) {
      // Case 2 & 3: Product ID exists (either with or without global product ID)
      // Existing product
      product = await Product.findById(productId).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Product not found', 404));
      }
      
      // Check if vendor already has this product
      const existingVendorProduct = await VendorProduct.findOne({
        productId: productId,
        vendorId: req.user?.id
      }).session(session);
      
      if (existingVendorProduct) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('You have already added this product', 400));
      }
      
      // Handle global product association if globalProductName is provided
      if (globalProductName && !globalProductId) {
        // Case 2: Product exists but global product ID doesn't exist, global product name is provided
        // Create a new global product and associate it with the existing product
        const globalProduct = new GlobalProduct({
          name: globalProductName,
          productIds: [product._id as mongoose.Types.ObjectId],
          isActive: true
        });
        
        await globalProduct.save({ session });
        
        // Set the global product reference on the product
        product.globalProduct = globalProduct._id as mongoose.Types.ObjectId;
        await product.save({ session });
      } else if (globalProductId) {
        // Case 3: Both global product ID and product exist
        // Associate them if not already associated
        const globalProduct = await GlobalProduct.findById(globalProductId).session(session);
        if (globalProduct) {
          // Add product to global product if not already there
          const productIdStr = (product._id as mongoose.Types.ObjectId).toString();
          if (!globalProduct.productIds.map(id => id.toString()).includes(productIdStr)) {
            globalProduct.productIds.push(product._id as mongoose.Types.ObjectId);
            await globalProduct.save({ session });
          }
          // Set the global product reference on the product if not already set
          if (!product.globalProduct) {
            product.globalProduct = globalProduct._id as mongoose.Types.ObjectId;
            await product.save({ session });
          }
        }
      }
    } else if (!productId && !globalProductId && globalProductName) {
      // Case 4: Neither global product ID nor product ID exist, but global product name is provided
      // Check if a global product with this name already exists
      let globalProduct = await GlobalProduct.findOne({ name: globalProductName }).session(session);
      
      if (globalProduct) {
        // Global product already exists, use it instead of creating a new one
        // Check if category exists and is active
        const categoryDoc = await Category.findById(category).session(session);
        if (!categoryDoc) {
          await session.abortTransaction();
          session.endSession();
          return next(new AppError('Category not found', 400));
        }
        
        if (!categoryDoc.isActive) {
          await session.abortTransaction();
          session.endSession();
          return next(new AppError('Cannot create product. Category is not active', 400));
        }
        
        // Create new product
        const productData = {
          name,
          description,
          category,
          brand,
          images: processedImages,
        };
        
        product = new Product(productData);
        await product.save({ session });
        
        // Add product to existing global product
        const productIdStr = (product._id as mongoose.Types.ObjectId).toString();
        if (!globalProduct.productIds.map(id => id.toString()).includes(productIdStr)) {
          globalProduct.productIds.push(product._id as mongoose.Types.ObjectId);
          await globalProduct.save({ session });
        }
        
        // Set the global product reference on the product
        product.globalProduct = globalProduct._id as mongoose.Types.ObjectId;
        await product.save({ session });
      } else {
        // Create new global product
        // Check if category exists and is active
        const categoryDoc = await Category.findById(category).session(session);
        if (!categoryDoc) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ message: 'Category not found' });
          return;
        }
        
        if (!categoryDoc.isActive) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ message: 'Cannot create product. Category is not active' });
          return;
        }
        
        // Create new product first
        const productData = {
          name,
          description,
          category,
          brand,
          images: processedImages,
        };
        
        product = new Product(productData);
        await product.save({ session });
        
        // Create new global product
        globalProduct = new GlobalProduct({
          name: globalProductName,
          productIds: [product._id as mongoose.Types.ObjectId],
          isActive: true
        });
        
        await globalProduct.save({ session });
        
        // Set the global product reference on the product
        product.globalProduct = globalProduct._id as mongoose.Types.ObjectId;
        await product.save({ session });
      }
    }
    
    // Check if we need to prevent duplicate vendor products
    let shouldCheckDuplicate = false;
    if (!productId && globalProductId && !globalProductName) {
      // For Case 1, we still need to check if vendor already has this product
      shouldCheckDuplicate = true;
    }
    
    if (!productId && !globalProductId && globalProductName) {
      // For Case 4, we still need to check if vendor already has this product
      shouldCheckDuplicate = true;
    }
    
    if (shouldCheckDuplicate && product) {
      // Check if vendor already has this product (for cases other than Case 1)
      const existingVendorProduct = await VendorProduct.findOne({
        productId: product._id,
        vendorId: req.user?.id
      }).session(session);
      
      if (existingVendorProduct) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: 'You have already added this product' });
        return;
      }
    }
    
    // Calculate total price
    const calculatedTotalPrice = (Number(price) || 0) + (Number(shippingPrice) || 0);
    
    // Create vendor product with pending status and isActive flag
    const vendorProduct = new VendorProduct({
      productId: product?._id as mongoose.Types.ObjectId,
      vendorId: req.user?._id, // Use authenticated user ID
      price: Number(price) || 0, // Default to 0 if not provided
      shippingPrice: Number(shippingPrice) || 0, // Default to 0 if not provided
      totalPrice: calculatedTotalPrice, // Calculate total price
      stock: Number(stock) || 0, // Default to 0 if not provided
      sku: sku || `SKU-${Date.now()}`, // Generate a default SKU if not provided
      status: 'pending', // Pending approval for both new and existing products
      isFeatured: isFeatured || false,
      isActive: isActive !== undefined ? isActive : true // Use provided isActive or default to true
    });
    
    await vendorProduct.save({ session });
    
    // If we reach here, everything was successful, so commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({ 
      message: 'Product added successfully. Awaiting admin approval.', 
      product: productId ? undefined : product, // Only return product for new products
      vendorProduct 
    });
  } catch (error: any) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    session.endSession();
    
    console.error(error);
    // Handle duplicate key error (E11000)
    if (error.code === 11000) {
      // Extract the duplicate key fields from the error
      const duplicateFields = Object.keys(error.keyPattern);
      const duplicateValues = error.keyValue;
      
      // Create a user-friendly error message
      let errorMessage = 'Product already exists for this vendor.';
      
      // More specific message based on the duplicate fields
      if (duplicateFields.includes('productId') && duplicateFields.includes('vendorId')) {
        errorMessage = 'You have already added this product.';
      } else if (duplicateFields.includes('sku')) {
        errorMessage = `A product with SKU '${duplicateValues.sku}' already exists.`;
      } else if (duplicateFields.includes('name')) {
        // Check if it's a global product name conflict
        errorMessage = `A global product with this name already exists.`;
      }
      
      res.status(409).json({ 
        message: errorMessage,
        // Optionally include the duplicate values for debugging (in development)
        // duplicateValues: duplicateValues
      });
    } else {
      // Handle other errors
      return next(new AppError('Error adding product: ' + (error.message || error), 400));
    }
  }
});

// Get vendor's products with aggregation for better performance
export const getVendorProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Build the aggregation pipeline
  const pipeline: any[] = [
    {
      $match: {
        vendorId: req.user._id
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    {
      $unwind: '$productDetails'
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'productDetails.category',
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
        localField: 'productDetails.brand',
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
        vendorId: 1,
        price: 1,
        shippingPrice: 1,
        totalPrice: 1,
        stock: 1,
        sku: 1,
        status: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        productDetails: {
          _id: 1,
          name: 1,
          description: 1,
          images: 1,
          isActive: 1,
          categoryDetails: {
            _id: 1,
            name: 1
          },
          brandDetails: {
            _id: 1,
            name: 1
          }
        },
        categoryDetails: {
          _id: 1,
          name: 1
        },
        brandDetails: {
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
    page,
    limit
  };
  
  const aggregate = VendorProduct.aggregate(pipeline);
  const result = await (VendorProduct.aggregatePaginate as any)(aggregate, options);
  
  res.status(200).json(result);
});

// Update vendor product
export const updateVendorProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorProduct = await VendorProduct.findOne({
    _id: req.params.id,
    vendorId: req.user._id
  }).populate('productId');
  
  if (!vendorProduct) {
    return next(new AppError('Product not found or you do not have permission to update it', 404));
  }
  
  // Update the vendor product fields
  // Handle isActive separately to ensure it's properly managed
  const { isActive, shippingPrice, ...otherFields } = req.body;
  
  // Calculate total price if shippingPrice or price is updated
  if (shippingPrice !== undefined || req.body.price !== undefined) {
    const newPrice = req.body.price !== undefined ? Number(req.body.price) : vendorProduct.price;
    const newShippingPrice = shippingPrice !== undefined ? Number(shippingPrice) : vendorProduct.shippingPrice;
    vendorProduct.totalPrice = newPrice + newShippingPrice;
  }
  
  Object.assign(vendorProduct, otherFields);
  
  // Update shippingPrice if provided
  if (shippingPrice !== undefined) {
    vendorProduct.shippingPrice = Number(shippingPrice);
  }
  
  // Update price if provided
  if (req.body.price !== undefined) {
    vendorProduct.price = Number(req.body.price);
  }
  
  // Note: isActive logic has been removed from here and moved to a separate endpoint
  // This prevents requiring admin approval for simple updates
  vendorProduct.status='pending'
  await vendorProduct.save();
  
  res.status(200).json({ 
    message: 'Product updated successfully. Please wait for admin approval.', 
    vendorProduct 
  });
});

// Delete vendor product
export const deleteVendorProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorProduct = await VendorProduct.findOneAndDelete({
    _id: req.params.id,
    vendorId: req.user._id
  });
  
  if (!vendorProduct) {
    return next(new AppError('Product not found or you do not have permission to delete it', 404));
  }
  
  res.status(200).json({ message: 'Product deleted successfully' });
});

// Toggle vendor product active status
export const toggleVendorProductActiveStatus = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorProduct = await VendorProduct.findOne({
    _id: req.params.id,
    vendorId: req.user._id
  });
  
  if (!vendorProduct) {
    return next(new AppError('Product not found or you do not have permission to update it', 404));
  }
  
  // Toggle the isActive status
  vendorProduct.isActive = !vendorProduct.isActive;
  
  // Save the updated product
  await vendorProduct.save();
  
  res.status(200).json({ 
    message: `Product ${vendorProduct.isActive ? 'activated' : 'deactivated'} successfully.`, 
    vendorProduct 
  });
});
