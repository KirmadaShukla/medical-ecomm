import { Router } from 'express';
import { 
  // Auth routes
  vendorLogin,
  sendVendorToken,
  // Product routes
  addNewProduct, 
  addExistingProduct, 
  getVendorProducts, 
  updateVendorProduct, 
  deleteVendorProduct 
} from '../controllers/vendorController';
import { isAuthenticated, isVendor } from '../middleware/auth';

const router = Router();

// Public vendor routes
router.post('/login', vendorLogin);

// Protected vendor routes
router.get('/token', isAuthenticated, isVendor, sendVendorToken);

// Apply authentication middleware to all vendor routes
router.use(isAuthenticated, isVendor);

// Product routes for vendors
router.post('/products/new', addNewProduct);
router.post('/products/existing', addExistingProduct);
router.get('/products', getVendorProducts);
router.put('/products/:id', updateVendorProduct);
router.delete('/products/:id', deleteVendorProduct);

export default router;