import { Request, Response } from 'express';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';
import Category from '../models/category';
import User from '../models/User';
import Vendor from '../models/vendors';
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

// Add new product (create new product and vendor product)
export const addNewProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if category exists and is active
    const category = await Category.findById(req.body.category);
    if (!category) {
      res.status(400).json({ message: 'Category not found' });
      return;
    }
    
    if (!category.isActive) {
      res.status(400).json({ message: 'Cannot create product. Category is not active' });
      return;
    }
    
    // Create new product
    const product = new Product({
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
      category: req.body.category,
      subCategory: req.body.subCategory,
      brand: req.body.brand,
      images: req.body.images,
      tags: req.body.tags,
      isActive: true
    });
    
    await product.save();
    
    // Create vendor product with pending status
    const vendorProduct = new VendorProduct({
      productId: product._id,
      vendorId: req.user.id, // Assuming vendor ID is in the authenticated user object
      price: req.body.price,
      comparePrice: req.body.comparePrice,
      stock: req.body.stock,
      sku: req.body.sku,
      status: 'pending', // Set to pending for new products
      isFeatured: req.body.isFeatured || false,
      discountPercentage: req.body.discountPercentage,
      shippingInfo: req.body.shippingInfo
    });
    
    await vendorProduct.save();
    
    res.status(201).json({ 
      message: 'Product created successfully. Awaiting admin approval.', 
      product, 
      vendorProduct 
    });
  } catch (error) {
    res.status(400).json({ message: 'Error creating product', error });
  }
};

// Add existing product (link to existing product)
export const addExistingProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, price, comparePrice, stock, sku, shippingInfo } = req.body;
    
    // Check if product exists
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    // Check if vendor already has this product
    const existingVendorProduct = await VendorProduct.findOne({
      productId: productId,
      vendorId: req.user.id
    });
    
    if (existingVendorProduct) {
      res.status(400).json({ message: 'You have already added this product' });
      return;
    }
    
    // Create vendor product with pending status
    const vendorProduct = new VendorProduct({
      productId: productId,
      vendorId: req.user.id, // Assuming vendor ID is in the authenticated user object
      price: price,
      comparePrice: comparePrice,
      stock: stock,
      sku: sku,
      status: 'pending', // Pending approval for existing products
      shippingInfo: shippingInfo
    });
    
    await vendorProduct.save();
    
    res.status(201).json({ 
      message: 'Product added successfully. Awaiting admin approval.', 
      vendorProduct 
    });
  } catch (error) {
    res.status(400).json({ message: 'Error adding product', error });
  }
};

// Get vendor's products with aggregation for better performance
export const getVendorProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorProducts = await VendorProduct.aggregate([
      {
        $match: {
          vendorId: req.user.id
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
    ]);
      
    res.status(200).json(vendorProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

// Update vendor product
export const updateVendorProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorProduct = await VendorProduct.findOne({
      _id: req.params.id,
      vendorId: req.user.id
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
      vendorId: req.user.id
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