import { Router } from 'express';
import {
  getGlobalProducts,
  getGlobalProductById,
  createGlobalProduct,
  updateGlobalProduct,
  deleteGlobalProduct,
  addProductToGlobalProduct,
  removeProductFromGlobalProduct,
  getProductsByGlobalProduct
} from '../controllers/globalProductController';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getGlobalProducts);
router.get('/:id', getGlobalProductById);
router.get('/:id/products', getProductsByGlobalProduct);

// Protected admin routes
router.post('/', isAuthenticated, isAdmin, createGlobalProduct);
router.put('/:id', isAuthenticated, isAdmin, updateGlobalProduct);
router.delete('/:id', isAuthenticated, isAdmin, deleteGlobalProduct);
router.post('/add-product', isAuthenticated, isAdmin, addProductToGlobalProduct);
router.post('/remove-product', isAuthenticated, isAdmin, removeProductFromGlobalProduct);

export default router;