import { Router } from 'express';
import {
  getAllProducts,
  getProductsByCategory,
  getProductsByBrand,
  getProductById,
  searchProducts,
  getFeaturedProducts,
  getFilters
} from '../controllers/productController';

const router = Router();

// Public routes
router.get('/products', getAllProducts);
router.get('/products/featured', getFeaturedProducts);
router.get('/products/filters', getFilters);
router.get('/products/search', searchProducts);
router.get('/products/category/:categoryId', getProductsByCategory);
router.get('/products/brand/:brandId', getProductsByBrand);
router.get('/products/:productId', getProductById);

export default router;