import { Router } from 'express';
import {
  getWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  clearWishlist,
  isItemInWishlist
} from '../controllers/wishlistController';
import { isAuthenticated, isUser } from '../middleware/auth';

const router = Router();

// Protected routes - User specific
router.get('/', isAuthenticated, isUser, getWishlist);
router.post('/items', isAuthenticated, isUser, addItemToWishlist);
router.delete('/items/:vendorProductId', isAuthenticated, isUser, removeItemFromWishlist);
router.delete('/', isAuthenticated, isUser, clearWishlist);
router.get('/check/:vendorProductId', isAuthenticated, isUser, isItemInWishlist);

export default router;