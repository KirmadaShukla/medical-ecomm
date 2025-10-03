import { Router } from 'express';
import { 
  // Auth routes
  vendorLogin,
  sendVendorToken,
  // Product routes
  addProduct, // Using the unified function instead of separate addNewProduct and addExistingProduct
  getVendorProducts, 
  updateVendorProduct, 
  deleteVendorProduct, 
  registerVendor
  // Remove order-related functions as they've been moved to orderRoutes.ts
} from '../controllers/vendorController';
import { isAuthenticated, isVendor } from '../middleware/auth';

const router = Router();

// Public vendor routes
router.post('/login', vendorLogin);
router.post('/register', registerVendor);
// This should be a public route for token verification
router.get('/token', sendVendorToken);

// Apply authentication middleware to all vendor routes
router.use(isAuthenticated, isVendor);

// Product routes for vendors
router.post('/products', addProduct); // Using the unified function
router.get('/products', getVendorProducts);
router.put('/products/:id', updateVendorProduct);
router.delete('/products/:id', deleteVendorProduct);

// Remove order routes as they've been moved to orderRoutes.ts

export default router;