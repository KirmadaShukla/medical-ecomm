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
  registerVendor,
  // New route for toggling active status
  toggleVendorProductActiveStatus
  // Remove order-related functions as they've been moved to orderRoutes.ts
} from '../controllers/vendorController';
import { isAuthenticated, isVendor } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { addProductSchema, updateProductSchema, vendorRegistrationSchema } from '../validation/vendorProductValidation';

const router = Router();

// Public vendor routes
router.post('/login', vendorLogin);
router.post('/register', validate(vendorRegistrationSchema), registerVendor);
// This should be a public route for token verification
router.get('/token', sendVendorToken);

// Apply authentication middleware to all vendor routes
router.use(isAuthenticated, isVendor);

// Product routes for vendors
router.post('/products', validate(addProductSchema), addProduct); // Using the unified function
router.get('/products', getVendorProducts);
router.put('/products/:id', validate(updateProductSchema), updateVendorProduct);
router.delete('/products/:id', deleteVendorProduct);
// New route for toggling active status
router.patch('/products/:id/toggle-active', toggleVendorProductActiveStatus);

// Remove order routes as they've been moved to orderRoutes.ts

export default router;