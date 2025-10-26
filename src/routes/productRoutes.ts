import { Router } from 'express';
import {
  getProductsByCategory,
  getProductsByBrand,
  getProductById,
  searchProducts,
  getFeaturedProducts,
  getFilters,
  getAllProductsPost,
  getProductsOnSale,
  getBestSellerProducts,
  getNewArrivalProducts,
  getLimitedEditionProducts
} from '../controllers/productController';

const router = Router();

// Public routes
router.post('/products', getAllProductsPost);
router.get('/products/featured', getFeaturedProducts);
router.get('/products/on-sale', getProductsOnSale);
router.get('/products/best-seller', getBestSellerProducts);
router.get('/products/new-arrival', getNewArrivalProducts);
router.get('/products/limited-edition', getLimitedEditionProducts);
router.get('/products/filters', getFilters);
router.get('/products/search', searchProducts);
router.get('/products/category/:categoryId', getProductsByCategory);
router.get('/products/brand/:brandId', getProductsByBrand);
router.get('/products/:vendorProductId', getProductById);

export default router;