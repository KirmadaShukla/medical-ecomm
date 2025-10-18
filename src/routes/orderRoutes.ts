import { Router } from 'express';
import { 
  // Customer order functions
  createOrder, 
  verifyPayment, 
  getUserOrders, 
  getOrderById, 
  cancelOrder,
  // Admin order functions
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatusAdmin,
  // Vendor order functions
  getVendorOrders,
  getVendorOrderById,
  updateOrderStatusVendor
} from '../controllers/orderController';
import { isUserAuthenticated, isAdminAuthenticated, isVendorAuthenticated } from '../middleware/auth';

const router = Router();

// Customer routes
router.post('/', isUserAuthenticated, createOrder);
router.post('/verify-payment', isUserAuthenticated, verifyPayment);
router.get('/my-orders', isUserAuthenticated, getUserOrders);
router.get('/my-orders/:id', isUserAuthenticated, getOrderById);
router.put('/my-orders/:id/cancel', isUserAuthenticated, cancelOrder);

// Admin routes
router.get('/admin', isAdminAuthenticated, getAdminOrders);
router.get('/admin/:id', isAdminAuthenticated, getAdminOrderById);
router.put('/admin/:id/status', isAdminAuthenticated, updateOrderStatusAdmin);

// Vendor routes
router.get('/vendor', isVendorAuthenticated, getVendorOrders);
router.get('/vendor/:id', isVendorAuthenticated, getVendorOrderById);
router.put('/vendor/:id/status', isVendorAuthenticated, updateOrderStatusVendor);

export default router;