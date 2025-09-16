import { Request, Response } from 'express';
import { User, UserModel, UserRole, UserStatus } from '../models/User';

// Mock data store
let users: User[] = [];
let nextId = 1;

export const getUsers = (req: Request, res: Response): void => {
  res.status(200).json(users);
};

export const getUserById = (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const user = users.find(u => u.id === id);
  
  if (user) {
    res.status(200).json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

export const createUser = (req: Request, res: Response): void => {
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
    medicalLicenseNumber,
    specialization,
    pharmacyName,
    emergencyContactName,
    emergencyContactPhone,
    insuranceProvider,
    insurancePolicyNumber,
    allergies,
    medicalConditions
  } = req.body;
  
  // Basic validation
  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ message: 'Missing required fields: firstName, lastName, email, password' });
    return;
  }
  
  // Check if user with this email already exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    res.status(409).json({ message: 'User with this email already exists' });
    return;
  }
  
  const newUser: User = new UserModel(
    nextId++,
    firstName,
    lastName,
    email,
    password,
    role || UserRole.PATIENT,
    status || UserStatus.ACTIVE,
    dateOfBirth ? new Date(dateOfBirth) : undefined,
    phoneNumber,
    address,
    city,
    state,
    zipCode,
    country,
    medicalLicenseNumber,
    specialization,
    pharmacyName,
    emergencyContactName,
    emergencyContactPhone,
    insuranceProvider,
    insurancePolicyNumber,
    allergies,
    medicalConditions
  );
  
  users.push(newUser);
  res.status(201).json(newUser);
};

export const updateUser = (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  
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
    medicalLicenseNumber,
    specialization,
    pharmacyName,
    emergencyContactName,
    emergencyContactPhone,
    insuranceProvider,
    insurancePolicyNumber,
    allergies,
    medicalConditions
  } = req.body;
  
  // Check if another user already has this email
  if (email && email !== users[userIndex].email) {
    const existingUser = users.find(u => u.email === email && u.id !== id);
    if (existingUser) {
      res.status(409).json({ message: 'User with this email already exists' });
      return;
    }
  }
  
  users[userIndex] = {
    ...users[userIndex],
    firstName: firstName || users[userIndex].firstName,
    lastName: lastName || users[userIndex].lastName,
    email: email || users[userIndex].email,
    password: password || users[userIndex].password,
    role: role || users[userIndex].role,
    status: status || users[userIndex].status,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : users[userIndex].dateOfBirth,
    phoneNumber: phoneNumber || users[userIndex].phoneNumber,
    address: address || users[userIndex].address,
    city: city || users[userIndex].city,
    state: state || users[userIndex].state,
    zipCode: zipCode || users[userIndex].zipCode,
    country: country || users[userIndex].country,
    medicalLicenseNumber: medicalLicenseNumber || users[userIndex].medicalLicenseNumber,
    specialization: specialization || users[userIndex].specialization,
    pharmacyName: pharmacyName || users[userIndex].pharmacyName,
    emergencyContactName: emergencyContactName || users[userIndex].emergencyContactName,
    emergencyContactPhone: emergencyContactPhone || users[userIndex].emergencyContactPhone,
    insuranceProvider: insuranceProvider || users[userIndex].insuranceProvider,
    insurancePolicyNumber: insurancePolicyNumber || users[userIndex].insurancePolicyNumber,
    allergies: allergies || users[userIndex].allergies,
    medicalConditions: medicalConditions || users[userIndex].medicalConditions,
    updatedAt: new Date()
  };
  
  res.status(200).json(users[userIndex]);
};

export const deleteUser = (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  
  users.splice(userIndex, 1);
  res.status(204).send();
};

// Get users by role
export const getUsersByRole = (req: Request, res: Response): void => {
  const role = req.params.role as UserRole;
  
  // Validate role
  if (!Object.values(UserRole).includes(role)) {
    res.status(400).json({ message: 'Invalid user role' });
    return;
  }
  
  const filteredUsers = users.filter(u => u.role === role);
  res.status(200).json(filteredUsers);
};

// Get active users
export const getActiveUsers = (req: Request, res: Response): void => {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);
  res.status(200).json(activeUsers);
};