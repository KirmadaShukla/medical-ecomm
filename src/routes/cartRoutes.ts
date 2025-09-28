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
router.get('/cart', isAuthenticated, isUser, getCart);
router.post('/cart/items', isAuthenticated, isUser, addItemToCart);
router.put('/cart/items/:itemId', isAuthenticated, isUser, updateCartItem);
router.delete('/cart/items/:itemId', isAuthenticated, isUser, removeItemFromCart);
router.delete('/cart', isAuthenticated, isUser, clearCart);

export default router;