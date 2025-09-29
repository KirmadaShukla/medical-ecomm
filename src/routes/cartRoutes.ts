import { Router } from 'express';
import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeItemFromCart,
  clearCart
} from '../controllers/cartController';
import { isAuthenticated, isUser } from '../middleware/auth';

const router = Router();

// Protected routes - User specific
router.get('/', isAuthenticated, isUser, getCart);
router.post('/items', isAuthenticated, isUser, addItemToCart);
router.put('/items/:vendorProductId', isAuthenticated, isUser, updateCartItem);
router.delete('/items/:vendorProductId', isAuthenticated, isUser, removeItemFromCart);
router.delete('/', isAuthenticated, isUser, clearCart);

export default router;