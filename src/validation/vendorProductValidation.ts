import Joi from 'joi';

// Validation schema for adding a product
export const addProductSchema = Joi.object({
  productId: Joi.string().optional(),
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(5000).optional(),
  category: Joi.string().optional(),
  brand: Joi.string().optional(),
  price: Joi.number().min(0).required(),
  discount: Joi.number().min(0).max(100).default(0),
  shippingPrice: Joi.number().min(0).default(0),
  stock: Joi.number().min(0).required(),
  sku: Joi.string().optional(),
  globalProductId: Joi.string().optional(),
  globalProductName: Joi.string().optional(),
  isFeatured: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  isOnSale: Joi.boolean().default(false),
  isBestSeller: Joi.boolean().default(false),
  isNewArrival: Joi.boolean().default(false),
  isLimitedEdition: Joi.boolean().default(false),
  images: Joi.array().items(Joi.string().uri()).optional()
});

// Validation schema for updating a product
export const updateProductSchema = Joi.object({
  price: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).max(100).optional(),
  shippingPrice: Joi.number().min(0).optional(),
  stock: Joi.number().min(0).optional(),
  sku: Joi.string().optional(),
  isFeatured: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  isOnSale: Joi.boolean().optional(),
  isBestSeller: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
  isLimitedEdition: Joi.boolean().optional(),
});

// Validation schema for vendor registration
export const vendorRegistrationSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  businessName: Joi.string().min(1).max(100).required(),
  businessLicense: Joi.string().min(1).max(100).required(),
  businessAddress: Joi.string().min(1).max(500).required(),
  businessPhone: Joi.string().min(1).max(20).required(),
  taxId: Joi.string().optional(),
  bankAccount: Joi.object({
    accountNumber: Joi.string().optional(),
    routingNumber: Joi.string().optional(),
    bankName: Joi.string().optional()
  }).optional()
});

// Validation schema for admin product updates
export const adminUpdateProductSchema = Joi.object({
  price: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).max(100).optional(),
  shippingPrice: Joi.number().min(0).optional(),
  stock: Joi.number().min(0).optional(),
  sku: Joi.string().optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  isFeatured: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  isOnSale: Joi.boolean().optional(),
  isBestSeller: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
  isLimitedEdition: Joi.boolean().optional()
});