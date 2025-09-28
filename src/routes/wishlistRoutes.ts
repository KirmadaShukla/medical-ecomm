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
router.get('/wishlist', isAuthenticated, isUser, getWishlist);
router.post('/wishlist/items', isAuthenticated, isUser, addItemToWishlist);
router.delete('/wishlist/items/:itemId', isAuthenticated, isUser, removeItemFromWishlist);
router.delete('/wishlist', isAuthenticated, isUser, clearWishlist);
router.get('/wishlist/check/:vendorProductId', isAuthenticated, isUser, isItemInWishlist);

export default router;