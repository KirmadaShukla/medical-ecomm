import Joi from 'joi';

// Validation schema for user registration
export const userRegistrationSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('customer', 'vendor', 'admin').optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  dateOfBirth: Joi.date().optional(),
  phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
  address: Joi.string().max(200).optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  zipCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).optional()
});

// Validation schema for user login
export const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Validation schema for updating user profile
export const updateUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  role: Joi.string().valid('customer', 'vendor', 'admin').optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  dateOfBirth: Joi.date().optional(),
  phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
  address: Joi.string().max(200).optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  zipCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).optional()
});

// Validation schema for admin updating user
export const adminUpdateUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  role: Joi.string().valid('customer', 'vendor', 'admin').optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  dateOfBirth: Joi.date().optional(),
  phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
  address: Joi.string().max(200).optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  zipCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).optional()
});