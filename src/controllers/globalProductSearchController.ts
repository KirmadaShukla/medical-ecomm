import { Request, Response } from 'express';
import GlobalProduct from '../models/globalProduct';
import Product from '../models/product';
import VendorProduct from '../models/vendorProduct';

// Search global products for vendors to link to
export const searchGlobalProductsForVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, category, brand, page = 1, limit = 10 } = req.query;
    
    // Build search filter
    const filter: any = { isActive: true };
    
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query as string, 'i')] } }
      ];
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (brand) {
      filter.brand = brand;
    }
    
    // Build the aggregation pipeline
    const pipeline: any[] = [
      { $match: filter },
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
          specifications: 1,
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
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const aggregate = GlobalProduct.aggregate(pipeline);
    const result = await (GlobalProduct.aggregatePaginate as any)(aggregate, options);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error searching global products', error });
  }
};

// Get vendor's products linked to a specific global product
export const getVendorProductsByGlobalProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalProductId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Build the aggregation pipeline
    const pipeline: any[] = [
      {
        $match: {
          vendorId: req.user.id,
          globalProductId: globalProductId as any
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
          from: 'globalproducts',
          localField: 'globalProductId',
          foreignField: '_id',
          as: 'globalProductDetails'
        }
      },
      {
        $unwind: {
          path: '$globalProductDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          productId: 1,
          vendorId: 1,
          globalProductId: 1,
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
          globalProduct: '$globalProductDetails'
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
    res.status(500).json({ message: 'Error fetching vendor products', error });
  }
};

// Check if vendor already has a product linked to a global product
export const checkGlobalProductAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalProductId } = req.params;
    
    // Check if vendor already has this global product
    const existingVendorProduct = await VendorProduct.findOne({
      globalProductId: globalProductId,
      vendorId: req.user.id
    });
    
    res.status(200).json({
      available: !existingVendorProduct,
      message: existingVendorProduct 
        ? 'You have already added this global product' 
        : 'This global product is available for you to add'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking global product availability', error });
  }
};