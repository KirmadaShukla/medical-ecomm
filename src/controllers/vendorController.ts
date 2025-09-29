import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';
import Category from '../models/category';
import User from '../models/User';
import Vendor from '../models/vendors';
import GlobalProduct from '../models/globalProduct';
import { generateVendorToken } from '../utils/tokenUtils';

// ==================== VENDOR REGISTRATION ====================

// Register a new vendor
export const registerVendor = async (req: Request, res: Response): Promise<void> => {
  try {
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
      res.status(400).json({ 
        message: 'Missing required fields: firstName, lastName, email, password, businessName, businessLicense, businessAddress, businessPhone' 
      });
      return;
    }
    
    // Check if vendor with this email already exists
    const existingVendor = await Vendor.findOne({ businessEmail: email });
    if (existingVendor) {
      res.status(409).json({ message: 'Vendor with this email already exists' });
      return;
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
  } catch (error) {
    res.status(500).json({ message: 'Error registering vendor', error });
  }
};

// ==================== AUTHENTICATION ====================

// Vendor login
export const vendorLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessEmail, password } = req.body;
    
    // Basic validation
    if (!businessEmail || !password) {
      res.status(400).json({ message: 'Please provide email and password' });
      return;
    }
    
    // Find vendor user by email and select password
    const user = await Vendor.findOne({ businessEmail, role: 'vendor' }).select('+password');
    
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
  } catch (error) {
    res.status(500).json({ message: 'Error during vendor login', error });
  }
};

// Send vendor token
export const sendVendorToken = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    // Check if user is vendor
    if (req.user.role !== 'vendor') {
      res.status(403).json({ message: 'Access denied. Vendors only.' });
      return;
    }
    
    // Generate vendor token
    const token = generateVendorToken(req.user);
    
    res.status(200).json({
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating vendor token', error });
  }
};

// ==================== PRODUCTS ====================

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

// Unified function to add products (both new and existing) - for vendors
export const addProduct = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      productId, // If provided, it's an existing product
      name, 
      description, 
      category, 
      subCategory, 
      brand, 
      images,
      tags,
      price, 
      comparePrice, 
      stock, 
      sku, 
      shippingInfo, 
      globalProductId, 
      globalProductName,
      isFeatured,
      discountPercentage
    } = req.body;
    
    let product;
    let processedImages = []; // Define processedImages at the top scope
    
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
        subCategory,
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
      
      // Check if vendor already has this product
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
      
      if (globalProduct) {
        // Global product already exists, use it instead of creating a new one
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
          subCategory,
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
          subCategory,
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
        
        // Check if vendor already has this product
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
          subCategory,
          brand,
          images: processedImages,
          tags,
          isActive: true
        };
        
        product = new Product(productData);
        await product.save({ session });
      }
      
      // Handle global product association
      await handleGlobalProduct(
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
      // For Case 4, we still need to check if vendor already has this product
      shouldCheckDuplicate = true;
    }
    
    if (shouldCheckDuplicate) {
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
    
    // Create vendor product with pending status
    const vendorProduct = new VendorProduct({
      productId: product._id as mongoose.Types.ObjectId,
      vendorId: req.user?._id, // Use authenticated user ID
      price: price || 0, // Default to 0 if not provided
      comparePrice: comparePrice,
      stock: stock || 0, // Default to 0 if not provided
      sku: sku || `SKU-${Date.now()}`, // Generate a default SKU if not provided
      status: 'pending', // Pending approval for both new and existing products
      isFeatured: isFeatured || false,
      discountPercentage: discountPercentage,
      shippingInfo: shippingInfo,
      images: productId ? undefined : processedImages // Only set images for new products
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
      res.status(400).json({ message: 'Error adding product', error: error.message || error });
    }
  }
};

// Get vendor's products with aggregation for better performance
export const getVendorProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get pagination parameters from query
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
          shippingInfo: 1,
          discountAmount: 1,
          isOnSale: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productDetails',
          category: '$categoryDetails',
          brand: '$brandDetails'
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
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

// Update vendor product
export const updateVendorProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorProduct = await VendorProduct.findOne({
      _id: req.params.id,
      vendorId: req.user._id
    }).populate('productId');
    
    if (!vendorProduct) {
      res.status(404).json({ message: 'Product not found or you do not have permission to update it' });
      return;
    }
    
    // Update the vendor product fields
    Object.assign(vendorProduct, req.body);
    
    // Set status to pending for admin review
    vendorProduct.status = 'pending';
    
    await vendorProduct.save();
    
    res.status(200).json({ 
      message: 'Product updated successfully. Awaiting admin approval.', 
      vendorProduct 
    });
  } catch (error) {
    res.status(400).json({ message: 'Error updating product', error });
  }
};

// Delete vendor product
export const deleteVendorProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorProduct = await VendorProduct.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user._id
    });
    
    if (!vendorProduct) {
      res.status(404).json({ message: 'Product not found or you do not have permission to delete it' });
      return;
    }
    
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error });
  }
};