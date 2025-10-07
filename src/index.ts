import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
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
import orderRoutes from './routes/orderRoutes';
import bannerRoutes from './routes/bannerRoutes';
import { connectDB } from './config/database';
import { globalErrorHandler } from './middleware/error';
// Load environment variables

// Connect to database
connectDB();

const app = express();
const PORT =  3002;

// Middleware
app.use(cors({
  origin:"*",
  credentials: true
}));
app.use(morgan('combined')); // Add Morgan middleware for logging
// Body parsing middleware should come before file upload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  // Preserve JSON body parsing for non-file requests
  preserveExtension: true,
  parseNested: true,
  defCharset: 'utf8',
  defParamCharset: 'utf8'
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
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/banners', bannerRoutes);

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