import jwt from 'jsonwebtoken';
import { User } from '../models/User';

// Generate JWT token
export const generateToken = (user: User): string => {
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
export const generateAdminToken = (user: User): string => {
  if (user.role !== 'admin') {
    throw new Error('User is not an admin');
  }
  
  return generateToken(user);
};

// Generate token for vendor user
export const generateVendorToken = (user: User): string => {
  if (user.role !== 'vendor') {
    throw new Error('User is not a vendor');
  }
  
  return generateToken(user);
};

// Generate token for regular user/customer
export const generateUserToken = (user: User): string => {
  if (user.role !== 'customer') {
    throw new Error('User is not a customer');
  }
  
  return generateToken(user);
};

// Verify token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch (error) {
    throw new Error('Invalid token');
  }
};