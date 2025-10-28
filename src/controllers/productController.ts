import { Request, Response, NextFunction } from 'express';
import { catchAsyncError, AppError } from '../utils/errorHandler';
import Product from '../models/product';
import Category from '../models/category';
import Brand from '../models/brand';
import VendorProduct from '../models/vendorProduct';
import { Types } from 'mongoose';

// Get all products with filters and aggregation
export const getAllProductsPost = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {  minPrice, maxPrice, sortBy, search, page = 1, limit = 10 } = req.query;
  const {category,brand}=req.body
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
  
  // Add search filter if provided
  if (search && typeof search === 'string' && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'productDetails.name': searchRegex },
          { 'productDetails.description': searchRegex },
          { 'categoryDetails.name': searchRegex },
          { 'brandDetails.name': searchRegex }
        ]
      }
    });
  }
  
  // Add category filter if provided (handle both single category and array of categories)
  if (category) {
    let categoryArray: any[] = [];
    if (Array.isArray(category)) {
      // Convert string IDs to ObjectId instances
      categoryArray = category.map((cat: string) => new Types.ObjectId(cat));
    } else if (typeof category === 'string') {
      // Check if it's a comma-separated string
      if (category.includes(',')) {
        categoryArray = category.split(',').map((cat: string) => new Types.ObjectId(cat.trim()));
      } else {
        categoryArray = [new Types.ObjectId(category)];
      }
    }
    
    if (categoryArray.length > 0) {
      pipeline.push({
        $match: {
          'productDetails.category': { $in: categoryArray }
        }
      });
    }
  }
  
  // Add brand filter if provided (handle both single brand and array of brands)
  if (brand) {
    let brandArray: any[] = [];
    if (Array.isArray(brand)) {
      // Convert string IDs to ObjectId instances
      brandArray = brand.map((br: string) => new Types.ObjectId(br));
    } else if (typeof brand === 'string') {
      // Check if it's a comma-separated string
      if (brand.includes(',')) {
        brandArray = brand.split(',').map((br: string) => new Types.ObjectId(br.trim()));
      } else {
        brandArray = [new Types.ObjectId(brand)];
      }
    }
    
    if (brandArray.length > 0) {
      pipeline.push({
        $match: {
          'productDetails.brand': { $in: brandArray }
        }
      });
    }
  }
  
  // Add price filters if provided
  if (minPrice || maxPrice) {
    const priceMatch: any = {};
    if (minPrice) {
      priceMatch.$gte = parseFloat(minPrice as string);
    }
    if (maxPrice) {
      priceMatch.$lte = parseFloat(maxPrice as string);
    }
    pipeline.push({
      $match: {
        price: priceMatch
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
      isFeatured: 1,
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
});

// Get products by category
export const getProductsByCategory = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
});

// Get products by brand
export const getProductsByBrand = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
});

// Get product by ID with vendor details
export const getProductById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { vendorProductId } = req.params;
  
  const vendorProduct = await VendorProduct.aggregate([
    {
      $match: {
        _id: new Types.ObjectId(vendorProductId),
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
          businessName: 1,
          businessAddress: 1,
          businessPhone: 1,
          businessEmail: 1
        }
      }
    }
  ]);
  
  if (!vendorProduct || vendorProduct.length === 0) {
    return next(new AppError('Product not found', 404));
  }
  
  res.status(200).json(vendorProduct[0]);
});

// Search products by name or tags
export const searchProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { query, page = 1, limit = 10, sortBy } = req.query;
  
  if (!query) {
    return next(new AppError('Search query is required', 400));
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
          businessName: 1,
          businessAddress: 1,
          businessPhone: 1,
          businessEmail: 1
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
});

// Get featured products
export const getFeaturedProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, sortBy } = req.query;
    
    console.log('getFeaturedProducts called with:', { page, limit, sortBy });
    
    // Build sort conditions
    let sortConditions: any = { createdAt: -1 };
    if (sortBy === 'price-low') {
      sortConditions = { price: 1 };
    } else if (sortBy === 'price-high') {
      sortConditions = { price: -1 };
    }
    
    // Use aggregation pipeline to safely handle ObjectId references
    const pipeline: any[] = [
      {
        $match: {
          isFeatured: true,
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
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true
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
            businessName: 1,
            businessAddress: 1,
            businessPhone: 1,
            businessEmail: 1
          }
        }
      },
      {
        $sort: sortConditions
      }
    ];
    
    console.log('Executing aggregation pipeline...');
    
    // Use aggregatePaginate for better error handling
    const result = await (VendorProduct.aggregatePaginate as any)(
      VendorProduct.aggregate(pipeline),
      {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    );
    
    console.log('Aggregation result:', { 
      totalDocs: result.totalDocs, 
      docsLength: result.docs?.length || 0 
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getFeaturedProducts:', error);
    console.error('Error stack:', (error as Error).stack);
    // Pass the error to the global error handler
    return next(error);
  }
});

// Get product filters (brands, categories, price range)
export const getFilters = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get all active categories
    const categories = await Category.find({ isActive: true }).select('_id name');
    
    // Get all active brands
    const brands = await Brand.find({ isActive: true }).select('_id name');
    
    // Get price range from vendor products
    const priceStats = await VendorProduct.aggregate([
      {
        $match: {
          status: 'approved',
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);
    
    const minPrice = priceStats.length > 0 ? priceStats[0].minPrice : 0;
    const maxPrice = priceStats.length > 0 ? priceStats[0].maxPrice : 0;
    
    res.status(200).json({
      categories,
      brands,
      priceRange: {
        min: minPrice,
        max: maxPrice
      }
    });
  } catch (error) {
    console.error('Error in getFilters:', error);
    return next(error);
  }
});

// Get products on sale
export const getProductsOnSale = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        isOnSale: true
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
        isOnSale: 1,
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
});

// Get best seller products
export const getBestSellerProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        isBestSeller: true
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
        isBestSeller: 1,
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
});

// Get new arrival products
export const getNewArrivalProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        isNewArrival: true
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
        isNewArrival: 1,
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
});

// Get limited edition products
export const getLimitedEditionProducts = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        isLimitedEdition: true
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
        isLimitedEdition: 1,
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
});
