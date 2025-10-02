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
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { 'vendorProducts.price': 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { 'vendorProducts.price': -1 };
    } else if (sortBy === 'name') {
      sortConditions = { 'productDetails.name': 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          status: 'approved',
          isActive: true
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
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      }
    ];
    
    // Add category filter if provided
    if (category) {
      pipeline.push({
        $match: {
          'productDetails.category': category
        }
      });
    }
    
    // Add brand filter if provided
    if (brand) {
      pipeline.push({
        $match: {
          'productDetails.brand': brand
        }
      });
    }
    
    // Add projection to limit fields
    pipeline.push({
      $project: {
        _id: 1,
        price: 1,
        stock: 1,
        sku: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        productDetails: {
          _id: 1,
          name: 1,
          description: 1,
          images: 1,
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
        },
        vendorDetails: {
          _id: 1,
          businessName: 1
        }
      }
    });
    
    // Add sorting
    pipeline.push({
      $sort: sortConditions
    });
    
    // Use aggregate pagination
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = VendorProduct.aggregate(pipeline);
    const result = await (VendorProduct.aggregatePaginate as any)(aggregate, options);
    
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
      sortConditions = { 'vendorProducts.price': 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { 'vendorProducts.price': -1 };
    } else if (sortBy === 'name') {
      sortConditions = { 'productDetails.name': 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          status: 'approved',
          isActive: true
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
        $match: {
          'productDetails.category': categoryId
        }
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
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          price: 1,
          stock: 1,
          sku: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          productDetails: {
            _id: 1,
            name: 1,
            description: 1,
            images: 1,
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
          },
          vendorDetails: {
            _id: 1,
            businessName: 1
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
    
    const aggregate = VendorProduct.aggregate(pipeline);
    const result = await (VendorProduct.aggregatePaginate as any)(aggregate, options);
    
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
      sortConditions = { 'vendorProducts.price': 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { 'vendorProducts.price': -1 };
    } else if (sortBy === 'name') {
      sortConditions = { 'productDetails.name': 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          status: 'approved',
          isActive: true
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
        $match: {
          'productDetails.brand': brandId
        }
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
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          price: 1,
          stock: 1,
          sku: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          productDetails: {
            _id: 1,
            name: 1,
            description: 1,
            images: 1,
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
          },
          vendorDetails: {
            _id: 1,
            businessName: 1
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
    
    const aggregate = VendorProduct.aggregate(pipeline);
    const result = await (VendorProduct.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products by brand', error });
  }
};

// Get product by ID with vendor details
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    const vendorProduct = await VendorProduct.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(productId),
          status: 'approved',
          isActive: true
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
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          price: 1,
          stock: 1,
          sku: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          productDetails: {
            _id: 1,
            name: 1,
            description: 1,
            images: 1,
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
          },
          vendorDetails: {
            _id: 1,
            businessName: 1
          }
        }
      }
    ]);
    
    if (!vendorProduct || vendorProduct.length === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    
    res.status(200).json(vendorProduct[0]);
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
      sortConditions = { 'vendorProducts.price': 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { 'vendorProducts.price': -1 };
    } else if (sortBy === 'name') {
      sortConditions = { 'productDetails.name': 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          status: 'approved',
          isActive: true
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
        $match: {
          $or: [
            { 'productDetails.name': { $regex: query, $options: 'i' } },
            { 'productDetails.tags': { $in: [query] } }
          ]
        }
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
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          price: 1,
          stock: 1,
          sku: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          productDetails: {
            _id: 1,
            name: 1,
            description: 1,
            images: 1,
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
          },
          vendorDetails: {
            _id: 1,
            businessName: 1
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
    
    const aggregate = VendorProduct.aggregate(pipeline);
    const result = await (VendorProduct.aggregatePaginate as any)(aggregate, options);
    
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
      sortConditions = { 'vendorProducts.price': 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { 'vendorProducts.price': -1 };
    } else if (sortBy === 'name') {
      sortConditions = { 'productDetails.name': 1 };
    }
    
    const pipeline: any[] = [
      {
        $match: {
          status: 'approved',
          isActive: true,
          isFeatured: true
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
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: {
          path: '$vendorDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          price: 1,
          stock: 1,
          sku: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          productDetails: {
            _id: 1,
            name: 1,
            description: 1,
            images: 1,
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
          },
          vendorDetails: {
            _id: 1,
            businessName: 1
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
    
    const aggregate = VendorProduct.aggregate(pipeline);
    const result = await (VendorProduct.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching featured products', error });
  }
};