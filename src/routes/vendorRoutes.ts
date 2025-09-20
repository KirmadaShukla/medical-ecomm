import { Router } from 'express';
import { 
  addNewProduct, 
  addExistingProduct, 
  getVendorProducts, 
  updateVendorProduct, 
  deleteVendorProduct 
} from '../controllers/vendorController';
import { isAuthenticated, isVendor } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all vendor routes
router.use(isAuthenticated, isVendor);

// Product routes for vendors
router.post('/products/new', addNewProduct);
router.post('/products/existing', addExistingProduct);
router.get('/products', getVendorProducts);
router.put('/products/:id', updateVendorProduct);
router.delete('/products/:id', deleteVendorProduct);

export default router;