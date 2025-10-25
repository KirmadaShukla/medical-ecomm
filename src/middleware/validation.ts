import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorHandler';

// Validation middleware function
export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessage = error.details.map((detail: any) => detail.message).join(', ');
      return next(new AppError(`Validation error: ${errorMessage}`, 400));
    }
    
    // Update req.body with validated/transformed values
    req.body = value;
    next();
  };
};