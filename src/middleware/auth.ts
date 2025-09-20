import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/User';

// Extend the Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// General authentication middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Attach user to request
    req.user = decoded;
    
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
  
  if (req.user.role !== UserRole.ADMIN) {
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
  
  if (req.user.role !== UserRole.VENDOR) {
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
  
  if (req.user.role !== UserRole.BUYER) {
    res.status(403).json({ message: 'Access denied. Customers only.' });
    return;
  }
  
  next();
};

// Combined middleware for admin or vendor
export const isAdminOrVendor = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.VENDOR) {
    res.status(403).json({ message: 'Access denied. Admins or vendors only.' });
    return;
  }
  
  next();
};