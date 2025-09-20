import mongoose from 'mongoose';

// Database configuration
export const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '27017', 10),
  username: process.env.DB_USERNAME || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medical_ecomm',
};

const MONGODB_URI = process.env.MONGODB_URI || 
  `mongodb://${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}`;

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB connected: ${MONGODB_URI}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default databaseConfig;