import { Request, Response } from 'express';
import Product from '../models/product';
import Category from '../models/category';
import Brand from '../models/brand';
import VendorProduct from '../models/vendorProduct';
import { Types } from 'mongoose';

// Get all products with filters and aggregation
export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, brand, minPrice, maxPrice, sortBy, page = 1, limit = 10 } = req.query;
    
    // Build match conditions
    const matchConditions: any = { isActive: true };
    
    if (category) {
      matchConditions.category = category;
    }
    
    if (brand) {
      matchConditions.brand = brand;
    }
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { minPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { minPrice: -1 };
    } else if (sortBy === 'name') {
      sortConditions = { name: 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'productId',
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.status': 'approved'
        }
      },
      {
        $unwind: '$vendorProducts'
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          category: { $first: '$category' },
          subCategory: { $first: '$subCategory' },
          brand: { $first: '$brand' },
          images: { $first: '$images' },
          tags: { $first: '$tags' },
          isActive: { $first: '$isActive' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          minPrice: { $min: '$vendorProducts.price' },
          maxPrice: { $max: '$vendorProducts.price' },
          avgPrice: { $avg: '$vendorProducts.price' },
          vendorCount: { $sum: 1 },
          vendorProducts: { $push: '$vendorProducts' }
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
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          minPrice: 1,
          maxPrice: 1,
          avgPrice: 1,
          vendorCount: 1,
          vendorProducts: {
            $slice: ['$vendorProducts', 5] // Limit to 5 vendor products
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
        $sort: sortConditions
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Product.aggregate(pipeline);
    const result = await (Product.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

// Get products by category
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10, sortBy } = req.query;
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { minPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { minPrice: -1 };
    } else if (sortBy === 'name') {
      sortConditions = { name: 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          category: categoryId,
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'productId',
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.status': 'approved'
        }
      },
      {
        $unwind: '$vendorProducts'
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          category: { $first: '$category' },
          subCategory: { $first: '$subCategory' },
          brand: { $first: '$brand' },
          images: { $first: '$images' },
          tags: { $first: '$tags' },
          isActive: { $first: '$isActive' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          minPrice: { $min: '$vendorProducts.price' },
          maxPrice: { $max: '$vendorProducts.price' },
          avgPrice: { $avg: '$vendorProducts.price' },
          vendorCount: { $sum: 1 },
          vendorProducts: { $push: '$vendorProducts' }
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
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          minPrice: 1,
          maxPrice: 1,
          avgPrice: 1,
          vendorCount: 1,
          vendorProducts: {
            $slice: ['$vendorProducts', 5] // Limit to 5 vendor products
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
        $sort: sortConditions
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Product.aggregate(pipeline);
    const result = await (Product.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products by category', error });
  }
};

// Get products by brand
export const getProductsByBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const { brandId } = req.params;
    const { page = 1, limit = 10, sortBy } = req.query;
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { minPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { minPrice: -1 };
    } else if (sortBy === 'name') {
      sortConditions = { name: 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          brand: brandId,
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'productId',
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.status': 'approved'
        }
      },
      {
        $unwind: '$vendorProducts'
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          category: { $first: '$category' },
          subCategory: { $first: '$subCategory' },
          brand: { $first: '$brand' },
          images: { $first: '$images' },
          tags: { $first: '$tags' },
          isActive: { $first: '$isActive' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          minPrice: { $min: '$vendorProducts.price' },
          maxPrice: { $max: '$vendorProducts.price' },
          avgPrice: { $avg: '$vendorProducts.price' },
          vendorCount: { $sum: 1 },
          vendorProducts: { $push: '$vendorProducts' }
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
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          minPrice: 1,
          maxPrice: 1,
          avgPrice: 1,
          vendorCount: 1,
          vendorProducts: {
            $slice: ['$vendorProducts', 5] // Limit to 5 vendor products
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
        $sort: sortConditions
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Product.aggregate(pipeline);
    const result = await (Product.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products by brand', error });
  }
};

// Get product by ID with vendor details
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    const product = await Product.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(productId),
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'productId',
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.status': 'approved'
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
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          vendorProducts: 1,
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
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    res.status(200).json(product[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error });
  }
};

// Search products by name or tags
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, page = 1, limit = 10, sortBy } = req.query;
    
    if (!query) {
      res.status(400).json({ message: 'Search query is required' });
      return;
    }
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { minPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { minPrice: -1 };
    } else if (sortBy === 'name') {
      sortConditions = { name: 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { tags: { $in: [query] } }
          ],
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'productId',
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.status': 'approved'
        }
      },
      {
        $unwind: '$vendorProducts'
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          category: { $first: '$category' },
          subCategory: { $first: '$subCategory' },
          brand: { $first: '$brand' },
          images: { $first: '$images' },
          tags: { $first: '$tags' },
          isActive: { $first: '$isActive' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          minPrice: { $min: '$vendorProducts.price' },
          maxPrice: { $max: '$vendorProducts.price' },
          avgPrice: { $avg: '$vendorProducts.price' },
          vendorCount: { $sum: 1 },
          vendorProducts: { $push: '$vendorProducts' }
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
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          minPrice: 1,
          maxPrice: 1,
          avgPrice: 1,
          vendorCount: 1,
          vendorProducts: {
            $slice: ['$vendorProducts', 5] // Limit to 5 vendor products
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
        $sort: sortConditions
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Product.aggregate(pipeline);
    const result = await (Product.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error searching products', error });
  }
};

// Get featured products
export const getFeaturedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, sortBy } = req.query;
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { minPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { minPrice: -1 };
    } else if (sortBy === 'name') {
      sortConditions = { name: 1 };
    }
    
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'vendorproducts',
          localField: '_id',
          foreignField: 'productId',
          as: 'vendorProducts'
        }
      },
      {
        $match: {
          'vendorProducts.status': 'approved',
          'vendorProducts.isFeatured': true,
          isActive: true
        }
      },
      {
        $unwind: '$vendorProducts'
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          category: { $first: '$category' },
          subCategory: { $first: '$subCategory' },
          brand: { $first: '$brand' },
          images: { $first: '$images' },
          tags: { $first: '$tags' },
          isActive: { $first: '$isActive' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          minPrice: { $min: '$vendorProducts.price' },
          maxPrice: { $max: '$vendorProducts.price' },
          avgPrice: { $avg: '$vendorProducts.price' },
          vendorCount: { $sum: 1 },
          vendorProducts: { $push: '$vendorProducts' }
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
          images: 1,
          tags: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          minPrice: 1,
          maxPrice: 1,
          avgPrice: 1,
          vendorCount: 1,
          vendorProducts: {
            $slice: ['$vendorProducts', 5] // Limit to 5 vendor products
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
        $sort: sortConditions
      }
    ];
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = Product.aggregate(pipeline);
    const result = await (Product.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching featured products', error });
  }
};