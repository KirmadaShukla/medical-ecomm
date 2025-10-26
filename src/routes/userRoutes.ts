import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByRole,
  getActiveUsers,
  loginUser,
  sendToken
} from '../controllers/userController';
import { isAuthenticated, isAdmin, isUser } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { userRegistrationSchema, userLoginSchema, updateUserSchema } from '../validation/userValidation';

const router = Router();

// Public routes
router.post('/users', validate(userRegistrationSchema), createUser);
router.post('/users/login', validate(userLoginSchema), loginUser);

// Protected routes - User specific
router.get('/users/profile', isAuthenticated, isUser, getUserById);
router.put('/users/profile', isAuthenticated, isUser, validate(updateUserSchema), updateUser);
router.get('/users/token', isAuthenticated, isUser, sendToken);

// Protected routes - Admin specific
router.get('/users', isAuthenticated, isAdmin, getUsers);
router.get('/users/role/:role', isAuthenticated, isAdmin, getUsersByRole);
router.get('/users/status/active', isAuthenticated, isAdmin, getActiveUsers);
router.get('/users/:id', isAuthenticated, isAdmin, getUserById);
router.put('/users/:id', isAuthenticated, isAdmin, validate(updateUserSchema), updateUser);
router.delete('/users/:id', isAuthenticated, isAdmin, deleteUser);

export default router;