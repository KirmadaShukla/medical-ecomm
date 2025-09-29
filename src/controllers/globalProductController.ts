import { Request, Response } from 'express';
import GlobalProduct from '../models/globalProduct';
import Product from '../models/product';
import mongoose from 'mongoose';
import { AppError } from '../utils/errorHandler';

// ==================== GLOBAL PRODUCT CRUD ====================

// Get all global products with pagination
export const getGlobalProducts = async (req: Request, res: Response): Promise<void> => {
  try {
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
          productIds: 1,
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
  } catch (error) {
    res.status(500).json({ message: 'Error fetching global products', error });
  }
};

// Get global product by ID
export const getGlobalProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalProduct = await GlobalProduct.findById(req.params.id);
    
    if (!globalProduct) {
      res.status(404).json({ message: 'Global product not found' });
      return;
    }
    
    res.status(200).json(globalProduct);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching global product', error });
  }
};

// Create a new global product (admin only)
export const createGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    // Create global product
    const globalProduct = new GlobalProduct({
      name: req.body.name,
      productIds: req.body.productIds || [],
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });
    
    await globalProduct.save();
    
    res.status(201).json(globalProduct);
  } catch (error: any) {
    // Handle duplicate key error (E11000)
    if (error.code === 11000) {
      const duplicateFields = Object.keys(error.keyPattern);
      const duplicateValues = error.keyValue;
      
      let errorMessage = 'Global product already exists with these details.';
      
      if (duplicateFields.includes('name')) {
        errorMessage = `A global product with name '${duplicateValues.name}' already exists.`;
      }
      
      res.status(409).json({ message: errorMessage });
    } else {
      res.status(400).json({ message: 'Error creating global product', error: error.message || error });
    }
  }
};

// Update global product (admin only)
export const updateGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalProduct = await GlobalProduct.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!globalProduct) {
      res.status(404).json({ message: 'Global product not found' });
      return;
    }
    
    res.status(200).json(globalProduct);
  } catch (error: any) {
    // Handle duplicate key error (E11000)
    if (error.code === 11000) {
      const duplicateFields = Object.keys(error.keyPattern);
      const duplicateValues = error.keyValue;
      
      let errorMessage = 'Global product already exists with these details.';
      
      if (duplicateFields.includes('name')) {
        errorMessage = `A global product with name '${duplicateValues.name}' already exists.`;
      }
      
      res.status(409).json({ message: errorMessage });
    } else {
      res.status(400).json({ message: 'Error updating global product', error: error.message || error });
    }
  }
};

// Delete global product (admin only)
export const deleteGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalProduct = await GlobalProduct.findByIdAndDelete(req.params.id);
    
    if (!globalProduct) {
      res.status(404).json({ message: 'Global product not found' });
      return;
    }
    
    res.status(200).json({ message: 'Global product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting global product', error });
  }
};

// Add product to global product
export const addProductToGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalProductId, productId } = req.body;
    
    // Check if global product exists
    const globalProduct = await GlobalProduct.findById(globalProductId);
    if (!globalProduct) {
      res.status(404).json({ message: 'Global product not found' });
      return;
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    // Check if product is already in the global product
    if (globalProduct.productIds.includes(productId)) {
      res.status(400).json({ message: 'Product is already associated with this global product' });
      return;
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
  } catch (error) {
    res.status(500).json({ message: 'Error adding product to global product', error });
  }
};

// Remove product from global product
export const removeProductFromGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalProductId, productId } = req.body;
    
    // Check if global product exists
    const globalProduct = await GlobalProduct.findById(globalProductId);
    if (!globalProduct) {
      res.status(404).json({ message: 'Global product not found' });
      return;
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    // Check if product is in the global product
    if (!globalProduct.productIds.includes(productId)) {
      res.status(400).json({ message: 'Product is not associated with this global product' });
      return;
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
  } catch (error) {
    res.status(500).json({ message: 'Error removing product from global product', error });
  }
};

// Get all products associated with a global product
export const getProductsByGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalProductId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Check if global product exists
    const globalProduct = await GlobalProduct.findById(globalProductId);
    if (!globalProduct) {
      res.status(404).json({ message: 'Global product not found' });
      return;
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
          category: 1,
          subCategory: 1,
          brand: 1,
          globalProduct: 1,
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          categoryDetails: 1,
          brandDetails: 1
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