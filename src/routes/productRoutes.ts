import { Router } from 'express';
import {
  getAllProducts,
  getProductsByCategory,
  getProductsByBrand,
  getProductById,
  searchProducts,
  getFeaturedProducts
} from '../controllers/productController';

const router = Router();

// Public routes
router.get('/products', getAllProducts);
router.get('/products/category/:categoryId', getProductsByCategory);
router.get('/products/brand/:brandId', getProductsByBrand);
router.get('/products/:productId', getProductById);
router.get('/products/search', searchProducts);
router.get('/products/featured', getFeaturedProducts);

export default router;