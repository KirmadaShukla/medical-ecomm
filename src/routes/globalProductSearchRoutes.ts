import { Router } from 'express';
import {
  searchGlobalProductsForVendor,
  getVendorProductsByGlobalProduct,
  checkGlobalProductAvailability
} from '../controllers/globalProductSearchController';
import { isAuthenticated, isVendor } from '../middleware/auth';

const router = Router();

// Vendor routes for searching and linking to global products
router.get('/search', isAuthenticated, isVendor, searchGlobalProductsForVendor);
router.get('/vendor/:globalProductId/products', isAuthenticated, isVendor, getVendorProductsByGlobalProduct);
router.get('/vendor/:globalProductId/availability', isAuthenticated, isVendor, checkGlobalProductAvailability);

export default router;