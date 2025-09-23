import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Vendor from '../models/vendors';
import Admin from '../models/admin';
import { UserRole } from '../models/User';

// Extend the Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Authentication middleware for users (customers)
export const isUserAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required for users' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Check if this is a user token
    if (decoded.role !== UserRole.BUYER && decoded.role !== 'customer') {
      res.status(401).json({ message: 'Invalid token: Not a customer token' });
      return;
    }
    
    // Find user in database
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive()) {
      res.status(401).json({ message: 'User not found or inactive' });
      return;
    }
    
    // Attach user to request
    req.user = user;
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Authentication middleware for vendors
export const isVendorAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required for vendors' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Check if this is a vendor token
    if (decoded.role !== UserRole.VENDOR && decoded.role !== 'vendor') {
      res.status(401).json({ message: 'Invalid token: Not a vendor token' });
      return;
    }
    
    // Find vendor in database
    const vendor = await Vendor.findById(decoded.id);
    if (!vendor || vendor.status !== 'approved') {
      // Check if vendor is pending approval
      if (vendor && vendor.status === 'pending') {
        res.status(401).json({ message: 'Please wait for approval from admin side' });
        return;
      } else if (vendor && vendor.status === 'rejected') {
        res.status(401).json({ message: 'Your vendor application has been rejected. Please contact support.' });
        return;
      } else if (vendor && vendor.status === 'suspended') {
        res.status(401).json({ message: 'Your vendor account has been suspended. Please contact support.' });
        return;
      }
      res.status(401).json({ message: 'Vendor not found or not approved' });
      return;
    }
    
    // Attach vendor to request
    req.user = vendor;
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Authentication middleware for admins
export const isAdminAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required for admins' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Check if this is an admin token
    if (decoded.role !== UserRole.ADMIN && decoded.role !== 'admin') {
      res.status(401).json({ message: 'Invalid token: Not an admin token' });
      return;
    }
    
    // Find admin in database
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      res.status(401).json({ message: 'Admin not found or inactive' });
      return;
    }
    
    // Attach admin to request
    req.user = admin;
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// General authentication middleware (checks all roles)
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    // Check role and find appropriate user
    let user = null;
    switch (decoded.role) {
      case UserRole.BUYER:
      case 'customer':
        user = await User.findById(decoded.id);
        if (user && !user.isActive()) {
          res.status(401).json({ message: 'Your account is not active. Please contact support.' });
          return;
        }
        break;
      case UserRole.VENDOR:
      case 'vendor':
        user = await Vendor.findById(decoded.id);
        if (user && user.status !== 'approved') {
          // Check if vendor is pending approval
          if (user.status === 'pending') {
            res.status(401).json({ message: 'Please wait for approval from admin side' });
            return;
          } else if (user.status === 'rejected') {
            res.status(401).json({ message: 'Your vendor application has been rejected. Please contact support.' });
            return;
          } else if (user.status === 'suspended') {
            res.status(401).json({ message: 'Your vendor account has been suspended. Please contact support.' });
            return;
          }
          user = null;
        }
        break;
      case UserRole.ADMIN:
      case 'admin':
        user = await Admin.findById(decoded.id);
        if (user && !user.isActive) {
          res.status(401).json({ message: 'Your admin account is not active. Please contact support.' });
          return;
        }
        break;
      default:
        res.status(401).json({ message: 'Invalid role in token' });
        return;
    }
    
    if (!user) {
      res.status(401).json({ message: 'User not found or unauthorized' });
      return;
    }
    
    // Attach user to request
    req.user = { ...user.toObject(), role: decoded.role };
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Admin authorization middleware
export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  
  if (req.user.role !== UserRole.ADMIN && req.user.role !== 'admin') {
    res.status(403).json({ message: 'Access denied. Admins only.' });
    return;
  }
  
  next();
};

// Vendor authorization middleware
export const isVendor = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  
  if (req.user.role !== UserRole.VENDOR && req.user.role !== 'vendor') {
    res.status(403).json({ message: 'Access denied. Vendors only.' });
    return;
  }
  
  next();
};

// User/customer authorization middleware
export const isUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  
  if (req.user.role !== UserRole.BUYER && req.user.role !== 'customer') {
    res.status(403).json({ message: 'Access denied. Customers only.' });
    return;
  }
  
  next();
};