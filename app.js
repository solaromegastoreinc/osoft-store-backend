// File: backend/app.js
// backend/app.js
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import analyticsRoutes from './routes/analyticsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import ebookProductRoutes from './routes/ebookProductRoutes.js';
import GenreRoutes from './routes/GenreRoutes.js';
import miscRoutes from './routes/miscRoutes.js';
import permissionRouter from './routes/permissionRoutes.js';
import uploadProfileRoutes from './routes/profileUploadRoutes.js';
import purchasesRoutes from './routes/purchasesRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import sliderEbookRoutes from './routes/sliderEbooksRoutes.js'; // Import slider ebook routes
import uploadRoutes from './routes/uploadRoutes.js';
import userRoutes from './routes/userRoutes.js';
//to upload ebook to backblaze b2 bucket
import cloudinary from 'cloudinary';
import cartRoutes from './routes/cartRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import ebookUploadRoutes from './routes/ebookUploadRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import premiumCodeRoutes from './routes/premiumCodesRoutes.js';
import premiumProductRoutes from './routes/PremiumProductRoutes.js'; // Import premium product routes
import metaEventsRoutes from './routes/metaEventsRoutes.js'; // Meta CAPI for server-side tracking

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();

app.use(cookieParser());

const allowedOrigins = (process.env.FRONTEND_URL || "").split(",");

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS blocked"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// app.use(cors({
//   origin: process.env.FRONTEND_URL,
//   credentials:true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

app.use(express.json());


// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});


// Routes
app.use('/api/download', downloadRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/misc', miscRoutes);
app.use('/api/productEbook', ebookProductRoutes);// Route for ebook products
app.use('/api/ebook-upload', ebookUploadRoutes); // Route for ebook file upload to backblaze b2 bucket
app.use('/api/upload', uploadRoutes);// Route for thumbnail image upload
app.use('/api/uploadProfile', uploadProfileRoutes);
app.use('/api/premium', premiumProductRoutes); // Route for premium products
app.use('/api/premium/codes', premiumCodeRoutes); // Route for premium codes
app.use('/api/roles', roleRoutes);
app.use('/api/genres', GenreRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/slider-ebooks', sliderEbookRoutes); // NEW: Mount slider ebook routes
app.use('/api/permissions', permissionRouter);
app.use('/api/purchases', purchasesRoutes); // NEW: Mount the new purchases route
app.use('/api/cart', cartRoutes);
app.use('/api/orders', checkoutRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/meta', metaEventsRoutes); // Meta CAPI server-side tracking

export default app;
