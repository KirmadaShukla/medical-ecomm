import { Request, Response } from 'express';
import Category from '../models/category';
import Brand from '../models/brand';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';
import Admin from '../models/admin';
import Vendor from '../models/vendors';
import User, { UserRole, UserStatus } from '../models/User';
import GlobalProduct from '../models/globalProduct';
import { generateAdminToken } from '../utils/tokenUtils';
import { AppError } from '../utils/errorHandler';
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
          subCategory: 1,
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
  
  try {
    const { 
      productId, // If provided, it's an existing product
      name, 
      description, 
      category, 
      brand, 
      images, 
      tags,
      price, 
      comparePrice, 
      stock, 
      sku, 
      shippingInfo, 
      globalProductId, 
      globalProductName 
    } = req.body;
    
    let product;
    
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
      
      // Process images to match the required format
      let processedImages = [];
      if (images) {
        if (Array.isArray(images)) {
          // If images is already an array, check if it contains objects or strings
          processedImages = images.map((img: any) => {
            if (typeof img === 'string') {
              // If it's a string, convert it to the required object format
              return {
                url: img,
                publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
                alt: name || 'Product image'
              };
            } else {
              // If it's already an object, use it as is
              return img;
            }
          });
        } else if (typeof images === 'string') {
          // If images is a string, convert it to the required format
          processedImages = [{
            url: images,
            publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
            alt: name || 'Product image'
          }];
        }
      }
      
      // Create new product
      const productData = {
        name,
        description,
        category,
        brand,
        images: processedImages,
        tags,
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
    } else if (productId && !globalProductId) {
      // Case 2 & 3: Product ID exists but global product ID doesn't exist (Case 2) or both exist (Case 3)
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
      if (globalProductName) {
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
        // Global product already exists, use it instead of creating a new one
        // Create new product
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
        
        // Process images to match the required format
        let processedImages = [];
        if (images) {
          if (Array.isArray(images)) {
            // If images is already an array, check if it contains objects or strings
            processedImages = images.map((img: any) => {
              if (typeof img === 'string') {
                // If it's a string, convert it to the required object format
                return {
                  url: img,
                  publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
                  alt: name || 'Product image'
                };
              } else {
                // If it's already an object, use it as is
                return img;
              }
            });
          } else if (typeof images === 'string') {
            // If images is a string, convert it to the required format
            processedImages = [{
              url: images,
              publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
              alt: name || 'Product image'
            }];
          }
        }
        
        // Create new product
        const productData = {
          name,
          description,
          category,
          brand,
          images: processedImages,
          tags,
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
        // Global product doesn't exist, create both new product and new global product
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
        
        // Process images to match the required format
        let processedImages = [];
        if (images) {
          if (Array.isArray(images)) {
            // If images is already an array, check if it contains objects or strings
            processedImages = images.map((img: any) => {
              if (typeof img === 'string') {
                // If it's a string, convert it to the required object format
                return {
                  url: img,
                  publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
                  alt: name || 'Product image'
                };
              } else {
                // If it's already an object, use it as is
                return img;
              }
            });
          } else if (typeof images === 'string') {
            // If images is a string, convert it to the required format
            processedImages = [{
              url: images,
              publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
              alt: name || 'Product image'
            }];
          }
        }
        
        // Create new product
        const productData = {
          name,
          description,
          category,
          brand,
          images: processedImages,
          tags,
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
    } else {
      // Default case: productId provided or no global product information provided
      if (productId) {
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
      } else {
        // New product
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
        
        // Process images to match the required format
        let processedImages = [];
        if (images) {
          if (Array.isArray(images)) {
            // If images is already an array, check if it contains objects or strings
            processedImages = images.map((img: any) => {
              if (typeof img === 'string') {
                // If it's a string, convert it to the required object format
                return {
                  url: img,
                  publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
                  alt: name || 'Product image'
                };
              } else {
                // If it's already an object, use it as is
                return img;
              }
            });
          } else if (typeof images === 'string') {
            // If images is a string, convert it to the required format
            processedImages = [{
              url: images,
              publicId: 'default_public_id', // This should be replaced with actual Cloudinary public ID
              alt: name || 'Product image'
            }];
          }
        }
        
        // Create new product
        const productData = {
          name,
          description,
          category,
          brand,
          images: processedImages,
          tags,
          isActive: true
        };
        
        product = new Product(productData);
        await product.save({ session });
      }
      
      // Handle global product logic
      const globalProduct = await handleGlobalProduct(
        product, 
        globalProductId, 
        globalProductName,
        session
      );
    }
    
    // For Case 1 (globalProductId provided but no productId), we don't need to check for duplicates
    // since we're creating a new product each time
    let shouldCheckDuplicate = true;
    if (!productId && globalProductId && !globalProductName) {
      shouldCheckDuplicate = false;
    }
    
    // Also check for Case 4 (neither productId nor globalProductId provided, but globalProductName is)
    // In this case, we should still check for duplicates
    if (!productId && !globalProductId && globalProductName) {
      // For Case 4, we still need to check if admin already has this product
      shouldCheckDuplicate = true;
    }
    
    if (shouldCheckDuplicate) {
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
      productId: product._id as mongoose.Types.ObjectId,
      vendorId: req.user?._id, // Use authenticated admin ID
      price: price || 0, // Default to 0 if not provided
      comparePrice: comparePrice,
      stock: stock || 0, // Default to 0 if not provided
      sku: sku || `SKU-${Date.now()}`, // Generate a default SKU if not provided
      status: 'approved', // Approved by default since admin is adding it
      shippingInfo: shippingInfo
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
        // Optionally include the duplicate values for debugging (in development)
        // duplicateValues: duplicateValues
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

// ==================== VENDOR MANAGEMENT ====================

// Get all vendors
export const getVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await Vendor.find().populate('userId', 'firstName lastName email');
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendors', error });
  }
};

// Get vendor by ID
export const getVendorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate('userId', 'firstName lastName email');
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
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ message: 'Invalid status. Must be one of: pending, approved, rejected, suspended' });
      return;
    }
    
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'firstName lastName email');
    
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }
    
    res.status(200).json({ 
      message: `Vendor ${status} successfully`, 
      vendor 
    });
  } catch (error) {
    res.status(400).json({ message: 'Error updating vendor status', error });
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
          discountPercentage: 1,
          images: 1,
          shippingInfo: 1,
          discountAmount: 1,
          isOnSale: 1,
          createdAt: 1,
          updatedAt: 1,
          productDetails: {
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
    const { status } = req.body;
    
    const vendorProduct = await VendorProduct.findByIdAndUpdate(
      req.params.id,
      { status },
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