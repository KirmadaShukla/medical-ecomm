import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  BUYER = 'customer',
  VENDOR = 'vendor',
  ADMIN = 'admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  dateOfBirth?: Date;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lastLoginAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateLastLogin(): Promise<IUser>;
  getFullName(): string;
  isActive(): boolean;
  getAge(): number | null;
  getFullAddress(): string;
}

const UserSchema: Schema = new Schema({
  firstName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: { 
    type: String, 
    enum: Object.values(UserRole),
    default: UserRole.BUYER
  },
  status: { 
    type: String, 
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE
  },
  dateOfBirth: { 
    type: Date 
  },
  phoneNumber: { 
    type: String,
    match: [/^[0-9+\-\s()]+$/, 'Please enter a valid phone number']
  },
  address: { 
    type: String,
    maxlength: 200
  },
  city: { 
    type: String,
    maxlength: 50
  },
  state: { 
    type: String,
    maxlength: 50
  },
  zipCode: { 
    type: String,
    maxlength: 20
  },
  country: { 
    type: String,
    maxlength: 50
  },
  lastLoginAt: { 
    type: Date 
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last login timestamp
UserSchema.methods.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  return this.save();
};

// Get user's full name
UserSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Check if user is active
UserSchema.methods.isActive = function() {
  return this.status === UserStatus.ACTIVE;
};

// Get user's age based on date of birth
UserSchema.methods.getAge = function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Get user's address as a formatted string
UserSchema.methods.getFullAddress = function() {
  const addressParts: string[] = [];
  if (this.address) addressParts.push(this.address);
  if (this.city) addressParts.push(this.city);
  if (this.state) addressParts.push(this.state);
  if (this.zipCode) addressParts.push(this.zipCode);
  if (this.country) addressParts.push(this.country);
  
  return addressParts.join(', ');
};

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });

const User = mongoose.model<IUser>('User', UserSchema);
export default User;