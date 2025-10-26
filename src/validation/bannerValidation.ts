import Joi from 'joi';

// Validation schema for creating a banner
export const createBannerSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  image: Joi.alternatives().try(
    Joi.string().uri(), // Direct image URL
    Joi.object({
      url: Joi.string().uri().required(),
      publicId: Joi.string().required(),
      alt: Joi.string().optional()
    })
  ).optional(),
  link: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().min(0).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

// Validation schema for updating a banner
export const updateBannerSchema = Joi.object({
  title: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  image: Joi.alternatives().try(
    Joi.string().uri(), // Direct image URL
    Joi.object({
      url: Joi.string().uri().optional(),
      publicId: Joi.string().optional(),
      alt: Joi.string().optional()
    })
  ).optional(),
  link: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().min(0).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});