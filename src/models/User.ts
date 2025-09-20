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

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export class UserModel implements User {
  id: number;
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
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;

  constructor(
    id: number,
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role: UserRole = UserRole.BUYER,
    status: UserStatus = UserStatus.ACTIVE,
    dateOfBirth?: Date,
    phoneNumber?: string,
    address?: string,
    city?: string,
    state?: string,
    zipCode?: string,
    country?: string,
    createdAt?: Date,
    updatedAt?: Date,
    lastLoginAt?: Date
  ) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.password = password;
    this.role = role;
    this.status = status;
    this.dateOfBirth = dateOfBirth;
    this.phoneNumber = phoneNumber;
    this.address = address;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
    this.country = country;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.lastLoginAt = lastLoginAt;
  }

  // Get user's full name
  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }


  // Check if user is active
  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  // Update last login timestamp
  updateLastLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  // Get user's age based on date of birth
  getAge(): number | null {
    if (!this.dateOfBirth) return null;
    
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Get user's address as a formatted string
  getFullAddress(): string {
    const addressParts = [];
    if (this.address) addressParts.push(this.address);
    if (this.city) addressParts.push(this.city);
    if (this.state) addressParts.push(this.state);
    if (this.zipCode) addressParts.push(this.zipCode);
    if (this.country) addressParts.push(this.country);
    
    return addressParts.join(', ');
  }
}