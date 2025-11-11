import { Request, Response, NextFunction } from 'express';
import { inspect } from 'util';
import Category from '../models/category';
import Brand from '../models/brand';
import Product, { IProduct } from '../models/product';
import VendorProduct, { IVendorProduct } from '../models/vendorProduct';
import Admin from '../models/admin';
import Vendor from '../models/vendors';
import User, { UserRole, UserStatus } from '../models/User';
import GlobalProduct from '../models/globalProduct';
import VendorPayment from '../models/vendorPayment';
import Order from '../models/order';
import { generateAdminToken } from '../utils/tokenUtils';
import { AppError, catchAsyncError } from '../utils/errorHandler';
import { uploadBrandImages, uploadProductImages, uploadCategoryImages } from '../utils/cloudinary';
import { deleteFromCloudinary } from '../utils/cloudinary';
import mongoose from 'mongoose';

// ==================== AUTHENTICATION ====================

// Admin registration
export const registerAdmin = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    email,
    password,
  } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return next(new AppError('Missing required fields: email, password', 400));
  }
  
  // Check if admin with this email already exists
  const existingAdmin = await Admin.findOne({ email, role: 'admin' });
  if (existingAdmin) {
    return next(new AppError('Admin with this email already exists', 409));
  }
  
  // Create admin user
  const admin = new Admin({
    email,
    password,
    role: 'admin',
    isActive: true,
  });
  
  await admin.save();
  
  // Generate admin token
  const token = generateAdminToken(admin);
  
  // Remove password from output
  const adminObj = admin.toObject();
  // @ts-ignore
  delete adminObj.password;
  
  res.status(201).json({
    message: 'Admin registered successfully',
    admin: adminObj,
    token
  });
});

// Admin login
export const adminLogin = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  // Find admin user by email and select password
  const user = await Admin.findOne({ email, role: 'admin' }).select('+password');
  
  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }
  
  // Check password
  const isPasswordCorrect = await user.comparePassword(password);
  
  if (!isPasswordCorrect) {
    return next(new AppError('Invalid email or password', 401));
  }
  
  // Update last login
  
  // Generate admin token
  const token = generateAdminToken(user);
  
  // Remove password from output
  const userObj = user.toObject();
  // @ts-ignore
  delete userObj.password;
  
  res.status(200).json({
    user: userObj,
    token
  });
});

// Send admin token
export const sendAdminToken = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }
  
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return next(new AppError('Access denied. Admins only.', 403));
  }
  
  // Generate admin token
  const token = generateAdminToken(req.user);
  
  res.status(200).json({
    token
  });
});

// ==================== CATEGORY CRUD ====================

export const getCategories = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const categories = await Category.find({}).sort({ sortOrder: 1 });
  res.status(200).json(categories);
});

export const getCategoryById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  res.status(200).json(category);
});

export const createCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { name, description, subCategories, parentId, isActive, sortOrder } = req.body;
  
  // Check if category with this name already exists
  const existingCategory = await Category.findOne({ name });
  if (existingCategory) {
    return next(new AppError('A category with this name already exists.', 409));
  }
  
  // Handle category image upload
  let processedImage: { url: string; publicId: string } | null = null;
  
  if (req.files && req.files.image) {
    const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
    // Generate a temporary ID for folder structure
    const tempCategoryId = new mongoose.Types.ObjectId().toString();
    const processedImages = await uploadCategoryImages(filesArray, tempCategoryId);
    processedImage = processedImages[0] || null;
  } else if (req.body.image) {
    // Handle existing image URL
    const image = req.body.image;
    if (typeof image === 'string') {
      processedImage = {
        url: image,
        publicId: 'default_public_id'
      };
    } else if (typeof image === 'object' && image.url) {
      processedImage = {
        url: image.url,
        publicId: image.publicId || 'default_public_id'
      };
    }
  }
  
  const categoryData: any = {
    name,
    description,
    subCategories: subCategories || [],
    parentId: parentId || null,
    isActive: isActive !== undefined ? isActive : true,
    sortOrder: sortOrder || 0
  };
  
  // Add image if it exists
  if (processedImage) {
    categoryData.image = processedImage;
  }
  
  const category: any = new Category(categoryData);
  await category.save();
  
  // Update the image folder path with the actual category ID
  if (processedImage && req.files && req.files.image) {
    try {
      // Delete the temporary image
      await deleteFromCloudinary(processedImage.publicId);
      
      // Upload again with correct folder path
      const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
      const processedImages = await uploadCategoryImages(filesArray, (category._id as mongoose.Types.ObjectId).toString());
      const newImage = processedImages[0] || null;
      
      if (newImage) {
        category.image = newImage;
        await category.save();
      }
    } catch (error) {
      console.error('Error updating category image folder path:', error);
    }
  }
  
  res.status(201).json(category);
});

export const updateCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { name, description, subCategories, parentId, isActive, sortOrder } = req.body;
  
  const updateFields: any = {};
  
  if (name !== undefined) updateFields.name = name;
  if (description !== undefined) updateFields.description = description;
  if (subCategories !== undefined) updateFields.subCategories = subCategories;
  if (parentId !== undefined) updateFields.parentId = parentId || null;
  if (isActive !== undefined) updateFields.isActive = isActive;
  if (sortOrder !== undefined) updateFields.sortOrder = sortOrder;
  
  // Handle image update
  if (req.files && req.files.image) {
    const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
    const processedImages = await uploadCategoryImages(filesArray, id);
    const processedImage = processedImages[0] || null;
    
    if (processedImage) {
      // Delete old image from Cloudinary
      const oldCategory = await Category.findById(id);
      if (oldCategory && oldCategory.image && oldCategory.image.publicId) {
        try {
          await deleteFromCloudinary(oldCategory.image.publicId);
        } catch (error) {
          console.error('Error deleting old image from Cloudinary:', error);
        }
      }
      
      updateFields.image = processedImage;
    }
  } else if (req.body.image) {
    // Handle existing image URL
    const image = req.body.image;
    if (typeof image === 'string') {
      updateFields.image = {
        url: image,
        publicId: 'default_public_id'
      };
    } else if (typeof image === 'object' && image.url) {
      updateFields.image = {
        url: image.url,
        publicId: image.publicId || 'default_public_id'
      };
    }
  }
  
  const category = await Category.findByIdAndUpdate(
    id,
    updateFields,
    { new: true, runValidators: true }
  );
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  res.status(200).json(category);
});

export const deleteCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  // Delete image from Cloudinary if it exists
  if (category.image && category.image.publicId) {
    try {
      await deleteFromCloudinary(category.image.publicId);
    } catch (error) {
      console.error('Error deleting category image from Cloudinary:', error);
    }
  }
  
  // Check if category has subcategories
  if (category.subCategories && category.subCategories.length > 0) {
    return next(new AppError('Cannot delete category with subcategories. Please delete subcategories first.', 400));
  }
  
  // Check if category is used in products
  const products = await Product.find({ category: category._id });
  if (products.length > 0) {
    return next(new AppError('Cannot delete category with products. Please reassign products first.', 400));
  }
  
  await category.deleteOne({});
  res.status(200).json({ message: 'Category deleted successfully' });
});

// ==================== SUBCATEGORY CRUD ====================

// Get subcategories by category ID
export const getSubCategoriesByCategoryId = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { categoryId } = req.params;
  
  const category = await Category.findById(categoryId, 'subCategories');
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  res.status(200).json(category.subCategories);
});

// Add subcategory to a category
export const addSubCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { categoryId } = req.params;
  const { name, description, isActive, sortOrder } = req.body;
  
  // Check if subcategory with this name already exists in this category
  const existingCategory = await Category.findOne({
    _id: categoryId,
    'subCategories.name': name
  });
  
  if (existingCategory) {
    return next(new AppError('A subcategory with this name already exists in this category.', 409));
  }
  
  const subCategoryData: any = {
    name,
    description,
    isActive: isActive !== undefined ? isActive : true,
    sortOrder: sortOrder || 0
  };
  
  const category = await Category.findByIdAndUpdate(
    categoryId,
    { $push: { subCategories: subCategoryData } },
    { new: true, runValidators: true }
  );
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  res.status(201).json(category);
});

// Update subcategory within a category
export const updateSubCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { categoryId, subCategoryId } = req.params;
  const { name, description, isActive, sortOrder } = req.body;
  
  // Check if another subcategory with this name already exists in this category
  if (name !== undefined) {
    const existingCategory = await Category.findOne({
      _id: categoryId,
      'subCategories.name': name,
      'subCategories._id': { $ne: subCategoryId }
    });
    
    if (existingCategory) {
      return next(new AppError('A subcategory with this name already exists in this category.', 409));
    }
  }
  
  const updateFields: any = {};
  
  if (name !== undefined) updateFields['subCategories.$.name'] = name;
  if (description !== undefined) updateFields['subCategories.$.description'] = description;
  if (isActive !== undefined) updateFields['subCategories.$.isActive'] = isActive;
  if (sortOrder !== undefined) updateFields['subCategories.$.sortOrder'] = sortOrder;
  
  const category = await Category.findOneAndUpdate(
    { _id: categoryId, 'subCategories._id': subCategoryId },
    updateFields,
    { new: true, runValidators: true }
  );
  
  if (!category) {
    return next(new AppError('Category or subcategory not found', 404));
  }
  
  res.status(200).json(category);
});

// Delete subcategory from a category
export const deleteSubCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { categoryId, subCategoryId } = req.params;
  
  // Remove subcategory from category
  const updatedCategory = await Category.findByIdAndUpdate(
    categoryId,
    { $pull: { subCategories: { _id: subCategoryId } } },
    { new: true, runValidators: true }
  );
  
  if (!updatedCategory) {
    return next(new AppError('Category not found', 404));
  }
  
  res.status(200).json({ message: 'Subcategory deleted successfully' });
});

// ==================== BRAND CRUD ====================

export const getBrands = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const brands = await Brand.find({}).sort({ sortOrder: 1 });
  res.status(200).json(brands);
});

export const getBrandById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    return next(new AppError('Brand not found', 404));
  }
  res.status(200).json(brand);
});

export const createBrand = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { name, description, isActive, sortOrder } = req.body;
  
  // Handle logo upload
  let processedLogo: { url: string; publicId: string; alt?: string } | null = null;
  
  if (req.files && req.files.logo) {
    const filesArray = Array.isArray(req.files.logo) ? req.files.logo : [req.files.logo];
    // Generate a temporary ID for folder structure
    const tempBrandId = new mongoose.Types.ObjectId().toString();
    const processedImages = await uploadBrandImages(filesArray, tempBrandId);
    processedLogo = processedImages[0] || null;
  } else if (req.body.logo) {
    // Handle existing logo URL
    const logo = req.body.logo;
    if (typeof logo === 'string') {
      processedLogo = {
        url: logo,
        publicId: 'default_public_id',
        alt: name || 'Brand logo'
      };
    } else if (typeof logo === 'object' && logo.url) {
      processedLogo = {
        url: logo.url,
        publicId: logo.publicId || 'default_public_id',
        alt: logo.alt || name || 'Brand logo'
      };
    }
  }
  
  const brandData: any = {
    name,
    description,
    isActive: isActive !== undefined ? isActive : true,
    sortOrder: sortOrder || 0
  };
  
  // Add logo if it exists
  if (processedLogo) {
    brandData.logo = processedLogo;
  }
  
  const brand: any = new Brand(brandData);
  await brand.save();
  
  // Update the logo folder path with the actual brand ID
  if (processedLogo && req.files && req.files.logo) {
    try {
      // Delete the temporary logo
      await deleteFromCloudinary(processedLogo.publicId);
      
      // Upload again with correct folder path
      const filesArray = Array.isArray(req.files.logo) ? req.files.logo : [req.files.logo];
      const processedImages = await uploadBrandImages(filesArray, (brand._id as mongoose.Types.ObjectId).toString());
      const newLogo = processedImages[0] || null;
      
      if (newLogo) {
        brand.logo = newLogo;
        await brand.save();
      }
    } catch (error) {
      console.error('Error updating brand logo folder path:', error);
    }
  }
  
  res.status(201).json(brand);
});

export const updateBrand = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { name, description, isActive, sortOrder } = req.body;
  
  const updateFields: any = {};
  
  if (name !== undefined) updateFields.name = name;
  if (description !== undefined) updateFields.description = description;
  if (isActive !== undefined) updateFields.isActive = isActive;
  if (sortOrder !== undefined) updateFields.sortOrder = sortOrder;
  
  // Handle logo update
  if (req.files && req.files.logo) {
    const filesArray = Array.isArray(req.files.logo) ? req.files.logo : [req.files.logo];
    const processedImages = await uploadBrandImages(filesArray, id);
    const processedLogo = processedImages[0] || null;
    
    if (processedLogo) {
      // Delete old logo from Cloudinary
      const oldBrand = await Brand.findById(id);
      if (oldBrand && oldBrand.logo && oldBrand.logo.publicId) {
        try {
          await deleteFromCloudinary(oldBrand.logo.publicId);
        } catch (error) {
          console.error('Error deleting old logo from Cloudinary:', error);
        }
      }
      
      updateFields.logo = processedLogo;
    }
  } else if (req.body.logo) {
    // Handle existing logo URL
    const logo = req.body.logo;
    if (typeof logo === 'string') {
      updateFields.logo = {
        url: logo,
        publicId: 'default_public_id',
        alt: name || 'Brand logo'
      };
    } else if (typeof logo === 'object' && logo.url) {
      updateFields.logo = {
        url: logo.url,
        publicId: logo.publicId || 'default_public_id',
        alt: logo.alt || name || 'Brand logo'
      };
    }
  }
  
  const brand = await Brand.findByIdAndUpdate(
    id,
    updateFields,
    { new: true, runValidators: true }
  );
  
  if (!brand) {
    return next(new AppError('Brand not found', 404));
  }
  
  res.status(200).json(brand);
});

export const deleteBrand = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const brand = await Brand.findById(req.params.id);
  
  if (!brand) {
    return next(new AppError('Brand not found', 404));
  }
  
  // Delete logo from Cloudinary if it exists
  if (brand.logo && brand.logo.publicId) {
    try {
      await deleteFromCloudinary(brand.logo.publicId);
    } catch (error) {
      console.error('Error deleting logo from Cloudinary:', error);
    }
  }
  
  // Delete the brand from database
  await Brand.findByIdAndDelete(req.params.id);
  
  res.status(200).json({ message: 'Brand deleted successfully' });
});

// ==================== PRODUCT CRUD ====================

export const getProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Get pagination parameters from query
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Build the aggregation pipeline
  const pipeline = [
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

export const getProductById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('getProductById',req.params.id);
  const product = await Product.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.params.id)
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
  ]);
  if (!product || product.length === 0) {
    return next(new AppError('Product not found', 404));
  }
  
  res.status(200).json(product[0]);
});


// Unified function to add products (both new and existing) - for admins
export const addProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { 
      productId, // If provided, it's an existing product
      name, 
      description, 
      category, 
      subCategory, // Add subCategory field
      brand, 
      price, 
      discount = 0, // Discount percentage (0-100), applied only to product price
      shippingPrice = 0,
      stock, 
      sku, 
      globalProductId, 
      globalProductName,
      isActive,
      isOnSale,
      isBestSeller,
      isNewArrival,
      isLimitedEdition
    } = req.body;
    
    // Validate required fields
    if (!name) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Product name is required', 400));
    }
    
    // Validate that if subCategory is provided, it belongs to the selected category
    if (subCategory) {
      const categoryDoc = await Category.findById(category);
      if (!categoryDoc) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Category not found', 400));
      }
      
      // Check if the subCategory exists in the category's subCategories array
      const subCategoryExists = categoryDoc.subCategories.some(
        (sub: any) => sub._id.toString() === subCategory
      );
      
      if (!subCategoryExists) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Subcategory does not belong to the selected category', 400));
      }
    }
    
    let product;
    let processedImages: { url: string; publicId: string; alt?: string }[] = [];
    
    // Handle image uploads if files are provided
    if (req.files && req.files.images) {
      // Handle both single file and multiple files
      let filesArray = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      
      // Upload images to Cloudinary with vendorId (admin ID) and temporary productId
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
        subCategory, // Add subCategory to product data
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
      
      // Check if admin already has this product
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
          subCategory, // Add subCategory to product data
          brand,
          images: processedImages,
          isActive: true
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
          return next(new AppError('Category not found', 400));
        }
        
        if (!categoryDoc.isActive) {
          await session.abortTransaction();
          session.endSession();
          return next(new AppError('Cannot create product. Category is not active', 400));
        }
        
        // Create new product first
        const productData = {
          name,
          description,
          category,
          subCategory, // Add subCategory to product data
          brand,
          images: processedImages,
          isActive: true
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
      // For Case 1, we still need to check if admin already has this product
      shouldCheckDuplicate = true;
    }
    
    if (!productId && !globalProductId && globalProductName) {
      // For Case 4, we still need to check if admin already has this product
      shouldCheckDuplicate = true;
    }
    
    if (shouldCheckDuplicate && product) {
      // Check if admin already has this product (for cases other than Case 1)
      const existingVendorProduct = await VendorProduct.findOne({
        productId: product._id,
        vendorId: req.user?.id
      }).session(session);
      
      if (existingVendorProduct) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('You have already added this product', 400));
      }
    }
    
    // Calculate total price based on price, discount, and shippingPrice
    const discountedPrice = (price || 0) * (1 - (discount || 0) / 100);
    const calculatedTotalPrice = Math.round((discountedPrice + (shippingPrice || 0)) * 100) / 100;
    
    // Create vendor product with approved status since admin is adding it
    const vendorProduct = new VendorProduct({
      productId: product?._id as mongoose.Types.ObjectId,
      vendorId: req.user?._id, // Use authenticated admin ID
      price: price || 0, // Default to 0 if not provided
      discount: discount || 0, // Add discount field
      shippingPrice: shippingPrice || 0, // Default to 0 if not provided
      totalPrice: calculatedTotalPrice, // Calculate total price
      stock: stock || 0, // Default to 0 if not provided
      sku: sku || `SKU-${Date.now()}`, // Generate a default SKU if not provided
      status: 'approved', // Approved by default since admin is adding it
      isActive: isActive !== undefined ? isActive : true, // Use provided isActive or default to true
      isOnSale: isOnSale || false,
      isBestSeller: isBestSeller || false,
      isNewArrival: isNewArrival || false,
      isLimitedEdition: isLimitedEdition || false
    });
    
    await vendorProduct.save({ session });
    
    // If we reach here, everything was successful, so commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({ 
      message: 'Product added successfully.', 
      product,
      vendorProduct 
    });
  } catch (error: any) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    session.endSession();
    
    // Handle duplicate key error (E11000)
    if (error.code === 11000) {
      // Extract the duplicate key fields from the error
      const duplicateFields = Object.keys(error.keyPattern);
      const duplicateValues = error.keyValue;
      
      // Create a user-friendly error message
      let errorMessage = 'Product already exists for this vendor.';
      
      // More specific message based on the duplicate fields
      if (duplicateFields.includes('productId') && duplicateFields.includes('vendorId')) {
        errorMessage = 'This product is already added for this vendor.';
      } else if (duplicateFields.includes('sku')) {
        errorMessage = `A product with SKU '${duplicateValues.sku}' already exists.`;
      } else if (duplicateFields.includes('name')) {
        // Check if it's a global product name conflict
        errorMessage = `A global product with this name already exists.`;
      }
      
      res.status(409).json({ 
        message: errorMessage,
      });
    } else {
      // Handle other errors
      return next(new AppError('Error adding product: ' + (error.message || error), 400));
    }
  }
});

export const updateProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { subCategory, category, ...updateData } = req.body;
  
  // Validate that if subCategory is provided, it belongs to the product's category
  if (subCategory) {
    const categoryDoc = await Category.findById(category);
    if (categoryDoc) {
      // Check if the subCategory exists in the category's subCategories array
      const subCategoryExists = categoryDoc.subCategories.some(
        (sub: any) => sub._id.toString() === subCategory
      );
      
      if (!subCategoryExists) {
        return next(new AppError('Subcategory does not belong to the selected category', 400));
      }
      
      updateData.subCategory = subCategory;
    }
  } else if (subCategory === null) {
    // Explicitly set to null to remove subCategory
    updateData.subCategory = null;
  }
  
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );
  
  if (!product) {
    return next(new AppError('Product not found', 404));
  }
  
  res.status(200).json(product);
});

export const deleteProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorProduct = await VendorProduct.findOneAndDelete({
    _id: req.params.id,
    vendorId: req.user._id
  });
  
  if (!vendorProduct) {
    return next(new AppError('Product not found or you do not have permission to delete it', 404));
  }
  
  res.status(200).json({ message: 'Product deleted successfully from your inventory only. Other vendors products remain unaffected.' });
});

export const getAdminUploadedProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Get pagination parameters from query
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Build the aggregation pipeline to get vendor products uploaded by any admin
  // First, we need to find all admin users to filter vendor products
  const adminUsers: any = await Admin.find({ role: 'admin' }, { _id: 1 });
  const adminIds = adminUsers.map((admin: any) => admin._id);
  
  const pipeline = [
    // Match products uploaded by any admin
    {
      $match: {
        vendorId: { $in: adminIds }
      }
    },
    // Lookup product details
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
    // Lookup category details
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
    // Lookup brand details
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
    // Project the required fields
    {
      $project: {
        _id: 1,
        price: 1,
        shippingPrice: 1,
        totalPrice:1,
        stock: 1,
        sku: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        productDetails: {
          _id: 1,
          name: 1,
          description: 1,
          images: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1
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

// Update admin uploaded product (vendor product info)
export const updateAdminUploadedProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // First, find the vendor product to ensure it was uploaded by an admin
  const adminUsers: any = await Admin.find({ role: 'admin' }, { _id: 1 });
  const adminIds = adminUsers.map((admin: any) => admin._id);
  
  const vendorProduct = await VendorProduct.findOne({
    _id: req.params.id,
    vendorId: { $in: adminIds }
  }).populate('productId');
  
  if (!vendorProduct) {
    return next(new AppError('Product not found or not uploaded by an admin', 404));
  }
  
  // Update the vendor product fields
  const { price, discount, stock, sku, status, isFeatured, isActive, shippingPrice, isOnSale, isBestSeller, isNewArrival, isLimitedEdition } = req.body;
  
  // Calculate total price if shippingPrice, price, or discount is updated
  if (shippingPrice !== undefined || price !== undefined || discount !== undefined) {
    const newPrice = price !== undefined ? price : vendorProduct.price;
    const newDiscount = discount !== undefined ? discount : vendorProduct.discount;
    const newShippingPrice = shippingPrice !== undefined ? shippingPrice : vendorProduct.shippingPrice;
    
    // Calculate discounted price (discount applied only to product price)
    const discountedPrice = newPrice * (1 - (newDiscount || 0) / 100);
    // Calculate total price (discounted price + shipping)
    vendorProduct.totalPrice = Math.round((discountedPrice + newShippingPrice) * 100) / 100;
  }
  
  if (price !== undefined) vendorProduct.price = price;
  if (discount !== undefined) vendorProduct.discount = discount; // Add discount field handling
  if (stock !== undefined) vendorProduct.stock = stock;
  if (sku !== undefined) vendorProduct.sku = sku;
  if (status !== undefined) vendorProduct.status = status;
  if (isFeatured !== undefined) vendorProduct.isFeatured = isFeatured;
  if (isActive !== undefined) vendorProduct.isActive = isActive;
  if (shippingPrice !== undefined) vendorProduct.shippingPrice = shippingPrice;
  if (isOnSale !== undefined) vendorProduct.isOnSale = isOnSale;
  if (isBestSeller !== undefined) vendorProduct.isBestSeller = isBestSeller;
  if (isNewArrival !== undefined) vendorProduct.isNewArrival = isNewArrival;
  if (isLimitedEdition !== undefined) vendorProduct.isLimitedEdition = isLimitedEdition;
  
  await vendorProduct.save();

  res.status(200).json({ 
    message: 'Vendor product information updated successfully. Only vendor-specific details (price, stock, SKU, status) can be updated here. To update core product information (name, description, etc.) that is shared across all vendors, use the main product update endpoint.',
    vendorProduct 
  });
});

// Delete admin uploaded product (vendor product)
export const deleteAdminUploadedProduct = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // First, find the vendor product to ensure it was uploaded by an admin
  const adminUsers: any = await Admin.find({ role: 'admin' }, { _id: 1 });
  const adminIds = adminUsers.map((admin: any) => admin._id);
  
  const vendorProduct = await VendorProduct.findOne({
    _id: req.params.id,
    vendorId: { $in: adminIds }
  }).populate('productId');
  
  if (!vendorProduct) {
    return next(new AppError('Product not found or not uploaded by an admin', 404));
  }
  
  // Delete the vendor product (this only removes the admin's listing, not the core product)
  await VendorProduct.findByIdAndDelete(req.params.id);
  
  res.status(200).json({ 
    message: 'Product deleted successfully from admin inventory. Note: This only removes the product from the admin\'s inventory, not the core product information which may be used by other vendors.' 
  });
});

// ==================== VENDOR MANAGEMENT ====================

// Get all vendors
export const getVendors = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendors = await Vendor.find();
  res.status(200).json(vendors);
});

// Get vendor by ID
export const getVendorById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) {
    return next(new AppError('Vendor not found', 404));
  }
  res.status(200).json(vendor);
});

// Update vendor status (approve/reject/suspend)
export const updateVendorStatus = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Check if body exists and is properly parsed
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError('Request body is required and must contain status field', 400));
  }
  
  const { status } = req.body;
  
  // Validate status
  const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
  if (!status) {
    return next(new AppError('Status is required', 400));
  }
  
  if (!validStatuses.includes(status)) {
    return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
  }
  
  const vendor = await Vendor.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  
  if (!vendor) {
    return next(new AppError('Vendor not found', 404));
  }
  
  res.status(200).json({ 
    message: `Vendor status updated to ${status} successfully`, 
    vendor 
  });
});

export const getVendorProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vendorProducts = await VendorProduct.aggregate([
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
        from: 'vendors',
        localField: 'vendorId',
        foreignField: '_id',
        as: 'vendorDetails'
      }
    },
    {
      $unwind: '$vendorDetails'
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
        totoalPrice: 1,
        stock: 1,
        sku: 1,
        status: 1,
        isFeatured: 1,
        images: 1,
        createdAt: 1,
        updatedAt: 1,
        productDetails: {
          _id: 1,
          name: 1,
          description: 1,
          images: 1,
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
        },
        vendorDetails: {
          businessEmail: 1,
          businessName: 1,
          status: 1,
          phone: 1
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
    }
  ]);
  
  res.status(200).json(vendorProducts);
});

// Update vendor product status (approve/reject)
export const updateVendorProductStatus = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { status, isActive } = req.body;
  
  // Prepare update object
  const updateFields: any = {};
  if (status !== undefined) updateFields.status = status;
  if (isActive !== undefined) updateFields.isActive = isActive
  
  const vendorProduct = await VendorProduct.findByIdAndUpdate(
    req.params.id,
    updateFields,
    { new: true }
  );
  
  if (!vendorProduct) {
    return next(new AppError('Vendor product not found', 404));
  }
  
  res.status(200).json({ 
    message: `Product updated successfully`, 
    vendorProduct 
  });
});

// Delete a specific image from a product
export const deleteProductImage = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { productId, imagePublicId } = req.params;

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Find the image in the product's images array
  const imageIndex = product.images.findIndex(img => img.publicId === imagePublicId);
  if (imageIndex === -1) {
    return next(new AppError('Image not found in product', 404));
  }

  // Delete the image from Cloudinary
  try {
    await deleteFromCloudinary(imagePublicId);
  } catch (cloudinaryError) {
    console.error('Error deleting image from Cloudinary:', cloudinaryError);
    // We'll continue with the operation even if Cloudinary deletion fails
  }

  // Remove the image from the product's images array
  product.images.splice(imageIndex, 1);

  // Save the updated product
  await product.save();

  res.status(200).json({ 
    message: 'Product image deleted successfully',
    product 
  });
});

// ==================== VENDOR PAYMENT MANAGEMENT ====================

// Get vendor sales data for a specific period
export const getVendorSales = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorId, startDate, endDate } = req.query;
  
  // Validate vendor ID
  if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId as string)) {
    return next(new AppError('Valid vendor ID is required', 400));
  }
  
  // Parse dates
  const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate ? new Date(endDate as string) : new Date();
  
  // Validate date range
  if (start > end) {
    return next(new AppError('Start date must be before end date', 400));
  }
  
  // Find the vendor
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return next(new AppError('Vendor not found', 404));
  }
  
  // Get all vendor products for this vendor with product details
  const vendorProducts = await VendorProduct.find({ vendorId: vendorId }).populate('productId');
  const vendorProductMap = new Map<string, any>();
  vendorProducts.forEach((vp) => {
    vendorProductMap.set((vp._id as mongoose.Types.ObjectId).toString(), vp);
  });
  const vendorProductIds = vendorProducts.map(vp => vp._id);
  
  // Find orders containing these vendor products within the date range
  const orders = await Order.find({
    'vendorProducts.vendorProductId': { $in: vendorProductIds },
    createdAt: { $gte: start, $lte: end },
    paymentStatus: 'completed',
    orderStatus:'delivered'
  });
  
  // Calculate total sales
  let totalSales = 0;
  let totalOrders = 0;
  const salesByProduct: any = {};
  
  orders.forEach(order => {
    totalOrders++;
    order.vendorProducts.forEach(item => {
      // Check if the vendor product ID is in our list
      if (vendorProductIds.some(id => (id as mongoose.Types.ObjectId).equals(item.vendorProductId))) {
        const itemTotal = item.price * item.quantity;
        totalSales += itemTotal;
        
        // Get product name from vendor product
        const vendorProduct = vendorProductMap.get(item.vendorProductId.toString());
        // Fix: Check if productId is populated and has name property
        const productName = (vendorProduct?.productId as unknown as IProduct)?.name || 'Unknown Product';
        
        // Track sales by product
        if (!salesByProduct[productName]) {
          salesByProduct[productName] = {
            quantity: 0,
            sales: 0
          };
        }
        salesByProduct[productName].quantity += item.quantity;
        salesByProduct[productName].sales += itemTotal;
      }
    });
  });
  
  // Format the response with more detailed information
  const salesData = {
    vendor: {
      id: vendor._id,
      businessName: vendor.businessName,
      businessEmail: vendor.businessEmail
    },
    period: {
      start,
      end
    },
    summary: {
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalOrders,
      averageOrderValue: totalOrders > 0 ? parseFloat((totalSales / totalOrders).toFixed(2)) : 0
    },
    salesByProduct,
    orders: orders.map(order => ({
      id: order._id,
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt
    }))
  };
  
  res.status(200).json(salesData);
});

// Generate payment for a vendor based on their sales
export const generateVendorPayment = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorId, startDate, endDate, notes } = req.body;
  
  // Validate required fields
  if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
    return next(new AppError('Valid vendor ID is required', 400));
  }
  
  if (!startDate || !endDate) {
    return next(new AppError('Start date and end date are required', 400));
  }
  
  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Validate date range
  if (start > end) {
    return next(new AppError('Start date must be before end date', 400));
  }
  
  // Find the vendor
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return next(new AppError('Vendor not found', 404));
  }
  
  // Get vendor sales for the period
  const vendorProducts = await VendorProduct.find({ vendorId: vendorId });
  const vendorProductIds = vendorProducts.map(vp => vp._id);
  
  const orders = await Order.find({
    'vendorProducts.vendorProductId': { $in: vendorProductIds },
    createdAt: { $gte: start, $lte: end },
    paymentStatus: 'completed'
  });
  
  // Calculate total sales
  let totalSales = 0;
  orders.forEach(order => {
    order.vendorProducts.forEach(item => {
      if (vendorProductIds.includes(item.vendorProductId)) {
        totalSales += item.price * item.quantity;
      }
    });
  });
  
  // Calculate payment amount (could be a percentage of sales or fixed amount)
  // For now, we'll use 80% of total sales as the payment to vendor
  const paymentAmount = totalSales * 0.8;
  
  // Create vendor payment record
  const vendorPayment = new VendorPayment({
    vendor: vendorId,
    amount: paymentAmount,
    periodStart: start,
    periodEnd: end,
    status: 'pending',
    notes
  });
  
  await vendorPayment.save();
  
  res.status(201).json({
    message: 'Vendor payment generated successfully',
    payment: vendorPayment,
    sales: {
      totalSales,
      paymentAmount
    }
  });
});

// Process vendor payment (mark as completed)
export const processVendorPayment = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { paymentId, transactionId } = req.body;
  
  // Validate payment ID
  if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
    return next(new AppError('Valid payment ID is required', 400));
  }
  
  // Find the payment
  const vendorPayment = await VendorPayment.findById(paymentId);
  if (!vendorPayment) {
    return next(new AppError('Vendor payment not found', 404));
  }
  
  // Update payment status
  vendorPayment.status = 'completed';
  vendorPayment.paymentDate = new Date();
  if (transactionId) {
    vendorPayment.transactionId = transactionId;
  }
  
  // Update vendor's last payment date
  const vendor = await Vendor.findById(vendorPayment.vendor);
  if (vendor) {
    vendor.lastPaymentDate = new Date();
    await vendor.save();
  }
  
  await vendorPayment.save();
  
  res.status(200).json({
    message: 'Vendor payment processed successfully',
    payment: vendorPayment
  });
});

// Get all vendor payments
export const getVendorPayments = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorId, status } = req.query;
  
  // Build query
  const query: any = {};
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId as string)) {
    query.vendor = vendorId;
  }
  if (status) {
    query.status = status;
  }
  
  // Get vendor payments with vendor details
  const vendorPayments = await VendorPayment.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'vendors',
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendorDetails'
      }
    },
    {
      $unwind: '$vendorDetails'
    },
    {
      $project: {
        _id: 1,
        vendor: 1,
        amount: 1,
        periodStart: 1,
        periodEnd: 1,
        paymentDate: 1,
        status: 1,
        transactionId: 1,
        notes: 1,
        createdAt: 1,
        updatedAt: 1,
        vendorDetails: {
          businessName: 1,
          businessEmail: 1
        }
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
  
  res.status(200).json(vendorPayments);
});
