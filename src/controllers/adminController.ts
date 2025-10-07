import { Request, Response } from 'express';
import { inspect } from 'util';
import Category from '../models/category';
import Brand from '../models/brand';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';
import Admin from '../models/admin';
import Vendor from '../models/vendors';
import User, { UserRole, UserStatus } from '../models/User';
import GlobalProduct from '../models/globalProduct';
import VendorPayment from '../models/vendorPayment';
import Order from '../models/order';
import { generateAdminToken } from '../utils/tokenUtils';
import { AppError } from '../utils/errorHandler';
import { uploadProductImages } from '../utils/cloudinary';
import { deleteFromCloudinary } from '../utils/cloudinary';
import mongoose from 'mongoose';

// ==================== AUTHENTICATION ====================

// Admin registration
export const registerAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
    } = req.body;
    
    // Basic validation
    if (!email || !password) {
      res.status(400).json({ message: 'Missing required fields: email, password' });
      return;
    }
    
    // Check if admin with this email already exists
    const existingAdmin = await Admin.findOne({ email, role: 'admin' });
    if (existingAdmin) {
      res.status(409).json({ message: 'Admin with this email already exists' });
      return;
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
  } catch (error) {
    res.status(500).json({ message: 'Error registering admin', error });
  }
};

// Admin login
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      res.status(400).json({ message: 'Please provide email and password' });
      return;
    }
    
    // Find admin user by email and select password
    const user = await Admin.findOne({ email, role: 'admin' }).select('+password');
    
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    
    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
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
  } catch (error) {
    res.status(500).json({ message: 'Error during admin login', error });
  }
};

// Send admin token
export const sendAdminToken = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      res.status(403).json({ message: 'Access denied. Admins only.' });
      return;
    }
    
    // Generate admin token
    const token = generateAdminToken(req.user);
    
    res.status(200).json({
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating admin token', error });
  }
};

// ==================== CATEGORY CRUD ====================

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({}).sort({ sortOrder: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error });
  }
};

export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category', error });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: 'Error creating category', error });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }
    
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: 'Error updating category', error });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }
    
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error });
  }
};

// ==================== BRAND CRUD ====================

export const getBrands = async (req: Request, res: Response): Promise<void> => {
  try {
    const brands = await Brand.find({}).sort({ sortOrder: 1 });
    res.status(200).json(brands);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brands', error });
  }
};

export const getBrandById = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }
    res.status(200).json(brand);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brand', error });
  }
};

export const createBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = new Brand(req.body);
    await brand.save();
    res.status(201).json(brand);
  } catch (error) {
    res.status(400).json({ message: 'Error creating brand', error });
  }
};

export const updateBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }
    
    res.status(200).json(brand);
  } catch (error) {
    res.status(400).json({ message: 'Error updating brand', error });
  }
};

export const deleteBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }
    
    res.status(200).json({ message: 'Brand deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting brand', error });
  }
};

// ==================== PRODUCT CRUD ====================

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
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
    console.log(product);
    if (!product || product.length === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    res.status(200).json(product[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error });
  }
};

// Helper function to handle global product logic
const handleGlobalProduct = async (product: any, globalProductId?: string, globalProductName?: string, session?: any) => {
  let globalProduct;
  
  if (globalProductId && !product) {
    // Case 1: Global product ID exists but product doesn't exist
    // Create a new product and associate it with the existing global product
    globalProduct = await GlobalProduct.findById(globalProductId).session(session || undefined);
    if (globalProduct) {
      // Create a new product since it doesn't exist
      // This case should be handled in the main function where product creation happens
      // Here we just return the global product for reference
      return globalProduct;
    }
  } else if (!globalProductId && product && globalProductName) {
    // Case 2: Product exists but global product ID doesn't exist, global product name is provided
    // Create a new global product and associate it with the existing product
    globalProduct = new GlobalProduct({
      name: globalProductName,
      productIds: [product._id as mongoose.Types.ObjectId],
      isActive: true
    });
    
    await globalProduct.save({ session });
    
    // Set the global product reference on the product
    product.globalProduct = globalProduct._id as mongoose.Types.ObjectId;
    await product.save({ session });
  } else if (globalProductId && product) {
    // Case 3: Both global product ID and product exist
    // Associate them if not already associated
    globalProduct = await GlobalProduct.findById(globalProductId).session(session || undefined);
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
  } else if (!globalProductId && !product && globalProductName) {
    // Case 4: Neither global product ID nor product exist, but global product name is provided
    // Create both new product and new global product
    globalProduct = new GlobalProduct({
      name: globalProductName,
      productIds: [], // Will be populated after product creation
      isActive: true
    });
    
    await globalProduct.save({ session });
    // Product will be created in the main function and then associated
    return globalProduct;
  }
  
  return globalProduct;
};

// Unified function to add products (both new and existing) - for admins
export const addProduct = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  console.log(req.body)
  try {
    const { 
      productId, // If provided, it's an existing product
      name, 
      description, 
      category, 
      brand, 
      price, 
      stock, 
      sku, 
      globalProductId, 
      globalProductName,
      isActive 
    } = req.body;
    
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
        res.status(404).json({ message: 'Global product not found' });
        return;
      }
      
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
        res.status(404).json({ message: 'Product not found' });
        return;
      }
      
      // Check if admin already has this product
      const existingVendorProduct = await VendorProduct.findOne({
        productId: productId,
        vendorId: req.user?.id
      }).session(session);
      
      if (existingVendorProduct) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: 'You have already added this product' });
        return;
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
      console.log("case 4 runned")
      if (globalProduct) {
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
        
        // Create new product
        const productData = {
          name,
          description,
          category,
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
        res.status(400).json({ message: 'You have already added this product' });
        return;
      }
    }
    
    // Create vendor product with approved status since admin is adding it
    const vendorProduct = new VendorProduct({
      productId: product?._id as mongoose.Types.ObjectId,
      vendorId: req.user?._id, // Use authenticated admin ID
      price: price || 0, // Default to 0 if not provided
      stock: stock || 0, // Default to 0 if not provided
      sku: sku || `SKU-${Date.now()}`, // Generate a default SKU if not provided
      status: 'approved', // Approved by default since admin is adding it
      isActive: isActive !== undefined ? isActive : true // Use provided isActive or default to true
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
      res.status(400).json({ message: 'Error adding product', error: error.message || error });
    }
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error updating product', error });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorProduct = await VendorProduct.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user._id
    });
    
    if (!vendorProduct) {
      res.status(404).json({ message: 'Product not found or you do not have permission to delete it' });
      return;
    }
    
    res.status(200).json({ message: 'Product deleted successfully from your inventory only. Other vendors products remain unaffected.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error });
  }
};

export const getAdminUploadedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
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
          stock: 1,
          sku: 1,
          status: 1,
          isFeatured: 1,
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
  } catch (error: any) {
    console.error('Error fetching admin uploaded products:', error);
    res.status(500).json({ message: 'Error fetching admin uploaded products', error: error.message || error });
  }
}

// Update admin uploaded product (vendor product info)
export const updateAdminUploadedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // First, find the vendor product to ensure it was uploaded by an admin
    const adminUsers: any = await Admin.find({ role: 'admin' }, { _id: 1 });
    const adminIds = adminUsers.map((admin: any) => admin._id);
    
    const vendorProduct = await VendorProduct.findOne({
      _id: req.params.id,
      vendorId: { $in: adminIds }
    }).populate('productId');
    
    if (!vendorProduct) {
      res.status(404).json({ message: 'Product not found or not uploaded by an admin' });
      return;
    }
    
    // Update the vendor product fields
    const { price, stock, sku, status, isFeatured, isActive } = req.body;
    
    if (price !== undefined) vendorProduct.price = price;
    if (stock !== undefined) vendorProduct.stock = stock;
    if (sku !== undefined) vendorProduct.sku = sku;
    if (status !== undefined) vendorProduct.status = status;
    if (isFeatured !== undefined) vendorProduct.isFeatured = isFeatured;
    if (isActive !== undefined) vendorProduct.isActive = isActive;
    
    await vendorProduct.save();
    
    // Note: Only vendor-specific information (price, stock, SKU, status) is updated here
    // Core product information (name, description, etc.) is shared across all vendors
    // To update core product information, use the separate product update endpoint
    // This ensures each vendor can maintain their own pricing and stock while sharing product details
    
    res.status(200).json({ 
      message: 'Vendor product information updated successfully. Only vendor-specific details (price, stock, SKU, status) can be updated here. To update core product information (name, description, etc.) that is shared across all vendors, use the main product update endpoint.',
      vendorProduct 
    });
  } catch (error: any) {
    console.error('Error updating admin uploaded product:', error);
    res.status(500).json({ message: 'Error updating admin uploaded product', error: error.message || error });
  }
}

// Delete admin uploaded product (vendor product)
export const deleteAdminUploadedProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    // First, find the vendor product to ensure it was uploaded by an admin
    const adminUsers: any = await Admin.find({ role: 'admin' }, { _id: 1 });
    const adminIds = adminUsers.map((admin: any) => admin._id);
    
    const vendorProduct = await VendorProduct.findOne({
      _id: req.params.id,
      vendorId: { $in: adminIds }
    }).populate('productId');
    
    if (!vendorProduct) {
      res.status(404).json({ message: 'Product not found or not uploaded by an admin' });
      return;
    }
    
    // Delete the vendor product (this only removes the admin's listing, not the core product)
    await VendorProduct.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      message: 'Product deleted successfully from admin inventory. Note: This only removes the product from the admin\'s inventory, not the core product information which may be used by other vendors.' 
    });
  } catch (error: any) {
    console.error('Error deleting admin uploaded product:', error);
    res.status(500).json({ message: 'Error deleting admin uploaded product', error: error.message || error });
  }
}

// ==================== VENDOR MANAGEMENT ====================

// Get all vendors
export const getVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await Vendor.find();
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendors', error });
  }
};

// Get vendor by ID
export const getVendorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }
    res.status(200).json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendor', error });
  }
};

// Update vendor status (approve/reject/suspend)
export const updateVendorStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== VENDOR STATUS UPDATE DEBUG INFO ===');
    console.log('Request body:', req.body);
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body length:', Object.keys(req.body).length);
    console.log('Request params:', req.params);
    console.log('Request param id:', req.params.id);
    console.log('Content-Type header:', req.headers['content-type']);
    console.log('All headers:', req.headers);
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Raw request dump:', inspect(req, { depth: 1, colors: false }));
    
    // Check if body exists and is properly parsed
    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ 
        message: 'Request body is required and must contain status field',
        receivedBody: req.body,
        receivedHeaders: req.headers,
        method: req.method,
        url: req.url,
        params: req.params
      });
      return;
    }
    
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    if (!status) {
      res.status(400).json({ 
        message: 'Status is required',
        receivedBody: req.body
      });
      return;
    }
    
    if (!validStatuses.includes(status)) {
      res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        receivedStatus: status
      });
      return;
    }
    
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }
    
    res.status(200).json({ 
      message: `Vendor status updated to ${status} successfully`, 
      vendor 
    });
  } catch (error) {
    console.error('Error updating vendor status:', error);
    res.status(500).json({ 
      message: 'Error updating vendor status', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getVendorProducts = async (req: Request, res: Response): Promise<void> => {
  try {
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
          productId: 1,
          vendorId: 1,
          price: 1,
          comparePrice: 1,
          stock: 1,
          reservedStock: 1,
          soldQuantity: 1,
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
          vendorDetails: 1,
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
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendor products', error });
  }
};

// Update vendor product status (approve/reject)
export const updateVendorProductStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, isActive } = req.body;
    
    // Prepare update object
    const updateFields: any = {};
    if (status !== undefined) updateFields.status = status;
    if (isActive !== undefined) updateFields.isActive = isActive;
    
    const vendorProduct = await VendorProduct.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );
    
    if (!vendorProduct) {
      res.status(404).json({ message: 'Vendor product not found' });
      return;
    }
    
    res.status(200).json({ 
      message: `Product ${status} successfully`, 
      vendorProduct 
    });
  } catch (error) {
    res.status(400).json({ message: 'Error updating vendor product status', error });
  }
};

// Delete a specific image from a product
export const deleteProductImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, imagePublicId } = req.params;

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Find the image in the product's images array
    const imageIndex = product.images.findIndex(img => img.publicId === imagePublicId);
    if (imageIndex === -1) {
      res.status(404).json({ message: 'Image not found in product' });
      return;
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
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product image', error });
  }
};

// ==================== VENDOR PAYMENT MANAGEMENT ====================

// Get vendor sales data for a specific period
export const getVendorSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorId, startDate, endDate } = req.query;
    
    // Validate vendor ID
    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId as string)) {
      res.status(400).json({ message: 'Valid vendor ID is required' });
      return;
    }
    
    // Parse dates
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Validate date range
    if (start > end) {
      res.status(400).json({ message: 'Start date must be before end date' });
      return;
    }
    
    // Find the vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }
    
    // Get all vendor products for this vendor
    const vendorProducts = await VendorProduct.find({ vendorId: vendorId });
    const vendorProductIds = vendorProducts.map(vp => vp._id);
    
    // Find orders containing these vendor products within the date range
    const orders = await Order.find({
      'vendorProducts.vendorProductId': { $in: vendorProductIds },
      createdAt: { $gte: start, $lte: end },
      paymentStatus: 'completed'
    });
    
    // Calculate total sales
    let totalSales = 0;
    let totalOrders = 0;
    const salesByProduct: any = {};
    
    orders.forEach(order => {
      totalOrders++;
      order.vendorProducts.forEach(item => {
        if (vendorProductIds.includes(item.vendorProductId)) {
          const itemTotal = item.price * item.quantity;
          totalSales += itemTotal;
          
          // Track sales by product
          if (!salesByProduct[item.productName]) {
            salesByProduct[item.productName] = {
              quantity: 0,
              sales: 0
            };
          }
          salesByProduct[item.productName].quantity += item.quantity;
          salesByProduct[item.productName].sales += itemTotal;
        }
      });
    });
    
    res.status(200).json({
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        businessEmail: vendor.businessEmail
      },
      period: {
        start,
        end
      },
      totalSales,
      totalOrders,
      salesByProduct
    });
  } catch (error) {
    console.error('Error fetching vendor sales:', error);
    res.status(500).json({ message: 'Error fetching vendor sales', error });
  }
};

// Generate payment for a vendor based on their sales
export const generateVendorPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorId, startDate, endDate, notes } = req.body;
    
    // Validate required fields
    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      res.status(400).json({ message: 'Valid vendor ID is required' });
      return;
    }
    
    if (!startDate || !endDate) {
      res.status(400).json({ message: 'Start date and end date are required' });
      return;
    }
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate date range
    if (start > end) {
      res.status(400).json({ message: 'Start date must be before end date' });
      return;
    }
    
    // Find the vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
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
  } catch (error) {
    console.error('Error generating vendor payment:', error);
    res.status(500).json({ message: 'Error generating vendor payment', error });
  }
};

// Process vendor payment (mark as completed)
export const processVendorPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId, transactionId } = req.body;
    
    // Validate payment ID
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      res.status(400).json({ message: 'Valid payment ID is required' });
      return;
    }
    
    // Find the payment
    const vendorPayment = await VendorPayment.findById(paymentId);
    if (!vendorPayment) {
      res.status(404).json({ message: 'Vendor payment not found' });
      return;
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
  } catch (error) {
    console.error('Error processing vendor payment:', error);
    res.status(500).json({ message: 'Error processing vendor payment', error });
  }
};

// Get all vendor payments
export const getVendorPayments = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error) {
    console.error('Error fetching vendor payments:', error);
    res.status(500).json({ message: 'Error fetching vendor payments', error });
  }
};

// ==================== BANNER MANAGEMENT ====================

// Get all banners
export const getBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const Banner = (await import('../models/banner')).default;
    const { page = 1, limit = 10, isActive } = req.query;
    
    // Build filter
    const filter: any = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sort: { sortOrder: 1, createdAt: -1 }
    };
    
    const result = await (Banner as any).paginate(filter, options);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ message: 'Error fetching banners', error: error.message });
  }
};

// Get banner by ID
export const getBannerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const Banner = (await import('../models/banner')).default;
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    
    res.status(200).json(banner);
  } catch (error: any) {
    console.error('Error fetching banner:', error);
    res.status(500).json({ message: 'Error fetching banner', error: error.message });
  }
};

// Create banner
export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const Banner = (await import('../models/banner')).default;
    const { title, description, link, isActive, sortOrder, startDate, endDate } = req.body;
    
    // Handle image upload
    let processedImage: { url: string; publicId: string; alt?: string } | null = null;
    
    if (req.files && req.files.image) {
      const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
      const processedImages = await uploadProductImages(filesArray, req.user?._id, 'banners');
      processedImage = processedImages[0] || null;
    } else if (req.body.image) {
      // Handle existing image URL
      const image = req.body.image;
      if (typeof image === 'string') {
        processedImage = {
          url: image,
          publicId: 'default_public_id',
          alt: title || 'Banner image'
        };
      } else if (typeof image === 'object' && image.url) {
        processedImage = {
          url: image.url,
          publicId: image.publicId || 'default_public_id',
          alt: image.alt || title || 'Banner image'
        };
      }
    }
    
    if (!processedImage) {
      res.status(400).json({ message: 'Banner image is required' });
      return;
    }
    
    const banner = new Banner({
      title,
      description,
      image: processedImage,
      link,
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    
    await banner.save();
    
    res.status(201).json({
      message: 'Banner created successfully',
      banner
    });
  } catch (error: any) {
    console.error('Error creating banner:', error);
    res.status(500).json({ message: 'Error creating banner', error: error.message });
  }
};

// Update banner
export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const Banner = (await import('../models/banner')).default;
    const { id } = req.params;
    const { title, description, link, isActive, sortOrder, startDate, endDate } = req.body;
    
    const updateFields: any = {};
    
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (link !== undefined) updateFields.link = link;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (sortOrder !== undefined) updateFields.sortOrder = sortOrder;
    if (startDate !== undefined) updateFields.startDate = new Date(startDate);
    if (endDate !== undefined) updateFields.endDate = new Date(endDate);
    
    // Handle image update
    if (req.files && req.files.image) {
      const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
      const processedImages = await uploadProductImages(filesArray, req.user?._id, 'banners');
      const processedImage = processedImages[0] || null;
      
      if (processedImage) {
        // Delete old image from Cloudinary
        const oldBanner = await Banner.findById(id);
        if (oldBanner && oldBanner.image.publicId) {
          try {
            await deleteFromCloudinary(oldBanner.image.publicId);
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
          publicId: 'default_public_id',
          alt: title || 'Banner image'
        };
      } else if (typeof image === 'object' && image.url) {
        updateFields.image = {
          url: image.url,
          publicId: image.publicId || 'default_public_id',
          alt: image.alt || title || 'Banner image'
        };
      }
    }
    
    const banner = await Banner.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    
    res.status(200).json({
      message: 'Banner updated successfully',
      banner
    });
  } catch (error: any) {
    console.error('Error updating banner:', error);
    res.status(500).json({ message: 'Error updating banner', error: error.message });
  }
};

// Delete banner
export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const Banner = (await import('../models/banner')).default;
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    
    // Delete image from Cloudinary
    if (banner.image.publicId) {
      try {
        await deleteFromCloudinary(banner.image.publicId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }
    
    await Banner.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Banner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ message: 'Error deleting banner', error: error.message });
  }
};
