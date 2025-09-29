import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import fileUpload from 'express-fileupload';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import vendorRoutes from './routes/vendorRoutes';
import productRoutes from './routes/productRoutes';
import globalProductRoutes from './routes/globalProductRoutes';
import globalProductSearchRoutes from './routes/globalProductSearchRoutes';
import cartRoutes from './routes/cartRoutes';
import wishlistRoutes from './routes/wishlistRoutes';
import { connectDB } from './config/database';
import { globalErrorHandler } from './middleware/error';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(morgan('combined')); // Add Morgan middleware for logging
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Routes
app.use('/api/v1', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/vendor', vendorRoutes);
app.use('/api/v1', productRoutes);
app.use('/api/v1/global-products', globalProductRoutes);
app.use('/api/v1/global-product-search', globalProductSearchRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);

// Basic route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Medical E-commerce API is running!',
    timestamp: new Date().toISOString(),
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'Connected'
  });
});

// Global error handler
app.use(globalErrorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API documentation: http://localhost:${PORT}/api-docs`);
});

export default app;