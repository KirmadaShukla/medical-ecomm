import { Request, Response, NextFunction } from 'express';
import { AppError, sendErrorDev, sendErrorProd } from '../utils/errorHandler';
import { Types } from 'mongoose';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // In production, filter out operational errors
    let error = { ...err };
    error.message = err.message;
    
    // Handle specific errors
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
    sendErrorProd(error, res);
  }
};

const handleCastErrorDB = (err: any) => {
  // More detailed CastError handling
  if (err.reason && err.reason.message) {
    const message = `Invalid data format: ${err.reason.message}. This usually happens when there's an invalid ObjectId reference in the database.`;
    console.error('CastError details:', err);
    return new AppError(message, 400);
  }
  
  // Handle specific ObjectId validation errors
  if (err.message && err.message.includes('24 character hex string')) {
    const message = 'Invalid ObjectId format. Please check the data integrity in the database.';
    console.error('ObjectId CastError details:', err);
    return new AppError(message, 400);
  }
  
  const message = `Invalid ${err.path}: ${err.value}. This usually happens when there's an invalid ObjectId reference in the database.`;
  console.error('CastError details:', err);
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err: any) => {
  // Check if errmsg exists before trying to access it
  if (!err.errmsg) {
    const message = 'Duplicate field value. Please use another value!';
    console.error('Duplicate field error details:', err);
    return new AppError(message, 400);
  }
  
  // Check if this is a vendor product duplicate (productId + vendorId)
  if (err.errmsg.includes('productId_1_vendorId_1')) {
    const message = 'This product is already added for this vendor.';
    return new AppError(message, 409); // 409 Conflict status code
  } 
  // Check if this is an SKU duplicate
  else if (err.errmsg.includes('sku_1')) {
    // Extract the duplicate SKU value from the error message
    const skuMatch = err.errmsg.match(/dup key: {[^}]*sku: "([^"]*)"/);
    const duplicateSku = skuMatch ? skuMatch[1] : 'unknown';
    const message = `A product with SKU '${duplicateSku}' already exists.`;
    return new AppError(message, 409); // 409 Conflict status code
  }
  // Check if this is a category name duplicate
  else if (err.errmsg.includes('name_1') && err.errmsg.includes('categories')) {
    const message = 'A category with this name already exists.';
    return new AppError(message, 409); // 409 Conflict status code
  }
  // Check if this is a brand name duplicate
  else if (err.errmsg.includes('name_1') && err.errmsg.includes('brands')) {
    const message = 'A brand with this name already exists.';
    return new AppError(message, 409); // 409 Conflict status code
  }
  // Generic duplicate field error
  else {
    // Safely extract the duplicate value
    const match = err.errmsg.match(/(["'])(\\?.)*?\1/);
    const value = match ? match[0] : 'unknown';
    const message = `Duplicate field value: ${value}. Please use another value!`;
    console.error('Duplicate field error details:', err);
    return new AppError(message, 400);
  }
};

const handleValidationErrorDB = (err: any) => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  console.error('ValidationError details:', err);
  return new AppError(message, 400);
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again!', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('Your token has expired! Please log in again.', 401);
};