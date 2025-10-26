import { Request, Response, NextFunction } from 'express';
import User, { IUser, UserRole, UserStatus } from '../models/User';
import { generateUserToken } from '../utils/tokenUtils';
import { catchAsyncError, AppError } from '../utils/errorHandler';

export const getUsers = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const users = await User.find({}, { 
    email: 1, 
    firstName: 1, 
    lastName: 1, 
    status: 1, 
    role: 1 
  });
  res.status(200).json(users);
});

export const getUserById = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = await User.findById(req.user._id, { 
    email: 1, 
    firstName: 1, 
    lastName: 1, 
    status: 1, 
    role: 1,
    dateOfBirth: 1,
    phoneNumber: 1,
    address: 1,
    city: 1,
    state: 1,
    zipCode: 1,
    country: 1
  });
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.status(200).json(user);
});

export const createUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    status,
    dateOfBirth,
    phoneNumber,
    address,
    city,
    state,
    zipCode,
    country,
  } = req.body;
  
  // Basic validation
  if (!firstName || !lastName || !email || !password) {
    return next(new AppError('Missing required fields: firstName, lastName, email, password', 400));
  }
  
  // Check if user with this email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 409));
  }
  
  const user = new User({
    firstName,
    lastName,
    email,
    password,
    role: role || UserRole.BUYER,
    status: status || UserStatus.ACTIVE,
    dateOfBirth,
    phoneNumber,
    address,
    city,
    state,
    zipCode,
    country,
  });
  
  await user.save();
  
  // Generate user token (only for customers)
  let token: string;
  try {
    token = generateUserToken(user);
  } catch (error) {
    return next(new AppError('Error generating token', 500));
  }
  
  // Remove password from output
  const userObj = user.toObject();
  // @ts-ignore
  delete userObj.password;
  
  res.status(201).json({
    user: userObj,
    token
  });
});

export const updateUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    status,
    dateOfBirth,
    phoneNumber,
    address,
    city,
    state,
    zipCode,
    country,
  } = req.body;
  
  const user = await User.findById(req.user._id);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  // Check if another user already has this email
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
    if (existingUser) {
      return next(new AppError('User with this email already exists', 409));
    }
  }
  
  // Update user fields
  user.firstName = firstName || user.firstName;
  user.lastName = lastName || user.lastName;
  user.email = email || user.email;
  if (password) user.password = password;
  user.role = role || user.role;
  user.status = status || user.status;
  user.dateOfBirth = dateOfBirth || user.dateOfBirth;
  user.phoneNumber = phoneNumber || user.phoneNumber;
  user.address = address || user.address;
  user.city = city || user.city;
  user.state = state || user.state;
  user.zipCode = zipCode || user.zipCode;
  user.country = country || user.country;
  
  await user.save();
  
  // Remove password from output
  const userObj = user.toObject();
  // @ts-ignore
  delete userObj.password;
  
  res.status(200).json(userObj);
});

export const deleteUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = await User.findByIdAndDelete(req.params.id);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.status(204).send();
});

// Get users by role
export const getUsersByRole = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const role = req.params.role as UserRole;
  
  // Validate role
  if (!Object.values(UserRole).includes(role)) {
    return next(new AppError('Invalid user role', 400));
  }
  
  const users = await User.find({ role }, { 
    email: 1, 
    firstName: 1, 
    lastName: 1, 
    status: 1, 
    role: 1 
  });
  res.status(200).json(users);
});

// Get active users
export const getActiveUsers = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const users = await User.find({ status: UserStatus.ACTIVE }, { 
    email: 1, 
    firstName: 1, 
    lastName: 1, 
    status: 1, 
    role: 1 
  });
  res.status(200).json(users);
});

// Login user
export const loginUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  // Find user by email and select password
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }
  
  // Check password
  const isPasswordCorrect = await user.comparePassword(password);
  
  if (!isPasswordCorrect) {
    return next(new AppError('Invalid email or password', 401));
  }
  
  // Update last login
  await user.updateLastLogin();
  
  // Generate user token (only for customers)
  let token: string;
  try {
    token = generateUserToken(user);
  } catch (error) {
    return next(new AppError('Error generating token', 500));
  }
  
  // Remove password from output
  const userObj = user.toObject();
  // @ts-ignore
  delete userObj.password;
  
  res.status(200).json({
    user: userObj,
    token
  });
});

// Send token based on user role
export const sendToken = catchAsyncError(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }
  
  // Generate user token (only for customers)
  let token: string;
  try {
    token = generateUserToken(req.user);
  } catch (error) {
    return next(new AppError('Error generating token', 500));
  }
  
  res.status(200).json({
    token
  });
});