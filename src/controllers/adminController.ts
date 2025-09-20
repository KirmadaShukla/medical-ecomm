import { Request, Response } from 'express';
import Category from '../models/category';
import Brand from '../models/brand';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';

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
    const products = await Product.aggregate([
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
          slug: 1,
          description: 1,
          category: 1,
          brand: 1,
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          categoryDetails: 1,
          brandDetails: 1
        }
      }
    ]);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.aggregate([
      {
        $match: {
          _id: req.params.id
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
          slug: 1,
          description: 1,
          category: 1,
          subCategory: 1,
          brand: 1,
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          categoryDetails: 1,
          brandDetails: 1
        }
      }
    ]);
    
    if (!product || product.length === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    res.status(200).json(product[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
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
    
    const product = new Product(req.body);
    await product.save();
    
    // Automatically approve the product
    const vendorProduct = new VendorProduct({
      productId: product._id,
      vendorId: req.body.adminId, // Assuming adminId is passed in the request
      price: req.body.price,
      stock: req.body.stock,
      sku: req.body.sku,
      status: 'approved', // Automatically approved by admin
      images: req.body.images || []
    });
    
    await vendorProduct.save();
    
    res.status(201).json({ product, vendorProduct });
  } catch (error) {
    res.status(400).json({ message: 'Error creating product', error });
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
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    // Also delete associated vendor products
    await VendorProduct.deleteMany({ productId: req.params.id });
    
    res.status(200).json({ message: 'Product and associated vendor products deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error });
  }
};

// ==================== VENDOR PRODUCT MANAGEMENT ====================

// Get all vendor products with product and vendor details
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
          product: '$productDetails',
          vendor: '$vendorDetails'
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