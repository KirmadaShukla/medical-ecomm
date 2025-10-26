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
import { validate } from '../middleware/validation';
import { createBannerSchema, updateBannerSchema } from '../validation/bannerValidation';

const router = Router();

// Public routes
router.get('/active', getActiveBanners);

// Admin routes
router.get('/', isAuthenticated, isAdmin, getBanners);
router.get('/:id', isAuthenticated, isAdmin, getBannerById);
router.post('/', isAuthenticated, isAdmin, validate(createBannerSchema), createBanner);
router.put('/:id', isAuthenticated, isAdmin, validate(updateBannerSchema), updateBanner);
router.delete('/:id', isAuthenticated, isAdmin, deleteBanner);

export default router;