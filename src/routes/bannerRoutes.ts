import { Router } from 'express';
import {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  getActiveBanners
} from '../controllers/bannerController';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/active', getActiveBanners);

// Admin routes
router.get('/', isAuthenticated, isAdmin, getBanners);
router.get('/:id', isAuthenticated, isAdmin, getBannerById);
router.post('/', isAuthenticated, isAdmin, createBanner);
router.put('/:id', isAuthenticated, isAdmin, updateBanner);
router.delete('/:id', isAuthenticated, isAdmin, deleteBanner);

export default router;