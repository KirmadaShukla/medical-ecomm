import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByRole,
  getActiveUsers
} from '../controllers/userController';

const router = Router();

router.get('/users', getUsers);
router.get('/users/role/:role', getUsersByRole);
router.get('/users/status/active', getActiveUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

export default router;