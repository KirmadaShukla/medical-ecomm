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
  getAdminUploadedProducts,
  updateAdminUploadedProducts,
  deleteAdminUploadedProduct,
  // Vendor routes
  getVendors,
  getVendorById,
  updateVendorStatus,
  // Payment routes
  getVendorSales,
  generateVendorPayment,
  processVendorPayment,
  getVendorPayments,
  // Banner routes
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner
} from '../controllers/adminController';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = Router();

// Public admin routes
router.post('/register', registerAdmin);
router.post('/login', adminLogin);

// Protected admin routes
router.get('/token', isAuthenticated, isAdmin, sendAdminToken);

// Category routes
router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryById);
router.post('/categories', isAuthenticated, isAdmin, createCategory);
router.put('/categories/:id', isAuthenticated, isAdmin, updateCategory);
router.delete('/categories/:id', isAuthenticated, isAdmin, deleteCategory);

// Brand routes
router.get('/brands', getBrands);
router.get('/brands/:id', getBrandById);
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

router.get('/get-admin-products',isAuthenticated,isAdmin,getAdminUploadedProducts)
router.put('/update-admin-products/:id',isAuthenticated,isAdmin,updateAdminUploadedProducts)
router.delete('/delete-admin-product/:id',isAuthenticated,isAdmin,deleteAdminUploadedProduct)
// Vendor product routes
router.get('/vendor-products', isAuthenticated, isAdmin, getVendorProducts);
router.put('/vendor-products/:id/status', isAuthenticated, isAdmin, updateVendorProductStatus);

// Vendor approval routes
router.get('/vendors', isAuthenticated, isAdmin, getVendors);
router.get('/vendors/:id', isAuthenticated, isAdmin, getVendorById);
router.put('/vendors/:id/status', isAuthenticated, isAdmin, updateVendorStatus);

// Vendor payment routes
router.get('/vendor-sales', isAuthenticated, isAdmin, getVendorSales);
router.post('/vendor-payments/generate', isAuthenticated, isAdmin, generateVendorPayment);
router.put('/vendor-payments/process', isAuthenticated, isAdmin, processVendorPayment);
router.get('/vendor-payments', isAuthenticated, isAdmin, getVendorPayments);

// Banner management routes
router.get('/banners', isAuthenticated, isAdmin, getBanners);
router.get('/banners/:id', isAuthenticated, isAdmin, getBannerById);
router.post('/banners', isAuthenticated, isAdmin, createBanner);
router.put('/banners/:id', isAuthenticated, isAdmin, updateBanner);
router.delete('/banners/:id', isAuthenticated, isAdmin, deleteBanner);

export default router;