import { Router } from 'express';
import {
  // Auth routes
  registerAdmin,
  adminLogin,
  sendAdminToken,
  // Category routes
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Brand routes
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  // Product routes
  getProducts,
  getProductById,
  addProduct, // Using the unified function instead of separate createProduct and addExistingProduct
  updateProduct,
  deleteProduct,
  deleteProductImage,
  // Vendor product routes
  getVendorProducts,
  updateVendorProductStatus,
} from '../controllers/adminController';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = Router();

// Public admin routes
router.post('/register', registerAdmin);
router.post('/login', adminLogin);

// Protected admin routes
router.get('/token', isAuthenticated, isAdmin, sendAdminToken);

// Category routes
router.get('/categories', isAuthenticated, isAdmin, getCategories);
router.get('/categories/:id', isAuthenticated, isAdmin, getCategoryById);
router.post('/categories', isAuthenticated, isAdmin, createCategory);
router.put('/categories/:id', isAuthenticated, isAdmin, updateCategory);
router.delete('/categories/:id', isAuthenticated, isAdmin, deleteCategory);

// Brand routes
router.get('/brands', isAuthenticated, isAdmin, getBrands);
router.get('/brands/:id', isAuthenticated, isAdmin, getBrandById);
router.post('/brands', isAuthenticated, isAdmin, createBrand);
router.put('/brands/:id', isAuthenticated, isAdmin, updateBrand);
router.delete('/brands/:id', isAuthenticated, isAdmin, deleteBrand);

// Product routes
router.get('/products', isAuthenticated, isAdmin, getProducts);
router.get('/products/:id', isAuthenticated, isAdmin, getProductById);
router.post('/products', isAuthenticated, isAdmin, addProduct); // Using the unified function
router.put('/products/:id', isAuthenticated, isAdmin, updateProduct);
router.delete('/products/:id', isAuthenticated, isAdmin, deleteProduct);
router.delete('/products/:productId/images/:imagePublicId', isAuthenticated, isAdmin, deleteProductImage);

// Vendor product routes
router.get('/vendor-products', isAuthenticated, isAdmin, getVendorProducts);
router.put('/vendor-products/:id/status', isAuthenticated, isAdmin, updateVendorProductStatus);

export default router;