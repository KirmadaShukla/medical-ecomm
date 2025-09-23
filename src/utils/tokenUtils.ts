import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Vendor, { IVendor } from '../models/vendors';
import { UserRole } from '../models/User';

// Generate JWT token
export const generateToken = (user: IUser): string => {
  const payload = { 
    id: user.id, 
    email: user.email, 
    role: user.role 
  };
  
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const expiresIn: any = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, secret, { expiresIn });
};

// Generate token for admin user
export const generateAdminToken = (user: IUser): string => {
  if (user.role !== UserRole.ADMIN) {
    throw new Error('User is not an admin');
  }
  
  return generateToken(user);
};

// Generate token for vendor user
export const generateVendorToken = (vendor: any): string => {
  // Create a payload that matches the IUser interface
  const payload = { 
    id: vendor._id, 
    email: vendor.businessEmail, 
    role: vendor.role || 'vendor' 
  };
  
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const expiresIn: any = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, secret, { expiresIn });
};

// Generate token for regular user/customer
export const generateUserToken = (user: IUser): string => {
  if (user.role !== UserRole.BUYER) {
    throw new Error('User is not a customer');
  }
  
  return generateToken(user);
};

