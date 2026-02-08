//backend/controllers/premiumAccountController.js
import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';
import { PremiumProduct } from '../models/PremiumProduct.js';
import Product from '../models/Product.js';

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'premium-thumbnails',
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    bufferStream.pipe(uploadStream);
  });
};

export const createPremiumProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      isAvailable,
      status,
      platform,
      duration,
      licenseType,
    } = req.body;

    let tags = req.body.tags;
    if (typeof tags === 'string') {
      tags = tags.split(',').filter(tag => tag.trim() !== '');
    } else if (!Array.isArray(tags)) {
      tags = [];
    }

    if (!name || !slug || !price || !platform || !duration || !licenseType) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }

    const existingProduct = await Product.findOne({ slug });
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        error: 'Slug must be unique'
      });
    }

    let thumbnailUrl = '';
    let thumbnailPublicId = '';

    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer);
        thumbnailUrl = result.secure_url;
        thumbnailPublicId = result.public_id;
      } catch (uploadError) {
        console.error('Thumbnail upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Thumbnail upload failed'
        });
      }
    }

    const premiumProduct = new PremiumProduct({
      name,
      slug,
      description: description || '',
      price: parseFloat(price),
      isAvailable: Boolean(isAvailable),
      status: status.toLowerCase(),
      tags,
      deliveryFormat: 'email',
      type: 'premium_account',
      platform,
      duration,
      licenseType,
      thumbnailUrl,
      thumbnailPublicId
    });

    const savedProduct = await premiumProduct.save();

    res.status(201).json({
      success: true,
      message: 'Premium account created successfully',
      product: savedProduct
    });
  } catch (error) {
    console.error('Error creating premium product:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: `Validation error: ${errors.join(', ')}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Updated listPremiumProducts with status filtering for general listings
export const listPremiumProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      searchQuery,
      minPrice,
      maxPrice,
      duration,
      licenseType,
      tags,
      status,
      forSlider = false, // Add this parameter to distinguish slider calls
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    // For general listings (not sliders), only show active products
    // For sliders, this will be handled by a separate endpoint
    if (!forSlider) {
      query.status = 'active';
    }

    // Apply Search Query
    if (searchQuery) {
      query.name = { $regex: searchQuery, $options: 'i' };
    }

    // Apply Price Range Filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Apply Duration Filter
    if (duration) {
      const durationArray = duration.split(',').map(d => d.trim());
      query.duration = { $in: durationArray };
    }

    // Apply License Type Filter
    if (licenseType) {
      const licenseTypeArray = licenseType.split(',').map(lt => lt.trim());
      query.licenseType = { $in: licenseTypeArray };
    }

    // Apply Tags Filter
    if (tags) {
      const tagsArray = tags.split(',').map(t => t.trim());
      query.tags = { $in: tagsArray };
    }

    // Apply Status Filter (only if explicitly provided)
    if (status) {
      query.status = status.toLowerCase();
    }

    console.log("Constructed MongoDB Query:", query);

    const total = await PremiumProduct.countDocuments(query);

    const products = await PremiumProduct.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      products,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });

  } catch (err) {
    console.error('Error listing premium products:', err);
    return res.status(500).json({ error: 'Failed to fetch premium products' });
  }
};

// Add a new function specifically for sliders (active products only)
export const getActivePremiumProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const limitNum = parseInt(limit);

    // Only get active premium products for sliders
    const products = await PremiumProduct.find({ 
      status: 'active'
    })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      products,
      total: products.length,
    });

  } catch (err) {
    console.error('Error fetching active premium products:', err);
    return res.status(500).json({ error: 'Failed to fetch active premium products' });
  }
};