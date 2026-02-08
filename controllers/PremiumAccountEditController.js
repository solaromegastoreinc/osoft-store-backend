// File: backend/controllers/PremiumAccountEditController.js
import { v2 as cloudinary } from 'cloudinary';
import { PremiumProduct } from '../models/PremiumProduct.js';

// GET single premium product by ID - NO STATUS FILTERING for direct URL access
export const getPremiumProduct = async (req, res) => {
  const { id } = req.params;
  try {
    // Don't filter by status - allow direct URL access to inactive products
    const product = await PremiumProduct.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Premium product not found' });
    }
    return res.status(200).json({ success: true, premiumProduct: product });
  } catch (err) {
    console.error('Error fetching premium product:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT update premium product
export const updatePremiumAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const premium = await PremiumProduct.findById(id);
    if (!premium) return res.status(404).json({ error: 'Premium account not found' });
    
    const body = req.body || {};

    // Handle thumbnail upload from Multer
    if (req.file) {
      const thumbFile = req.file;

      // Delete old thumbnail if exists
      if (premium.thumbnailPublicId) {
        try {
          await cloudinary.uploader.destroy(premium.thumbnailPublicId, { invalidate: true });
        } catch (err) {
          console.warn('Could not delete old thumbnail:', err.message);
        }
      }

      // Upload new thumbnail
      const thumbRes = await new Promise((resolve, reject) => {
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

        uploadStream.end(thumbFile.buffer);
      });

      premium.thumbnailUrl = thumbRes.secure_url;
      premium.thumbnailPublicId = thumbRes.public_id;
      
      thumbFile.buffer = null;
    }

    // Update other fields
    const updateFields = [
      'name', 'slug', 'description', 'price', 'isAvailable',
      'status', 'tags', 'platform', 'duration', 'licenseType'
    ];

    updateFields.forEach(field => {
      if (body[field] !== undefined) {
        premium[field] = body[field];
      }
    });

    // Handle array fields
    if (body.tags) {
      if (typeof body.tags === 'string') {
        body.tags = body.tags.split(',').filter(tag => tag.trim() !== '');
      }
    }

    if (body.tags !== undefined) {
      premium.tags = body.tags;
    }

    // Convert price to number
    if (body.price) {
      premium.price = parseFloat(body.price);
    }

    // Convert boolean fields
    if (body.isAvailable !== undefined) {
      premium.isAvailable = body.isAvailable === 'true';
    }

    const updated = await premium.save();
    res.json(updated);

  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
};

// DELETE premium product
export const deletePremiumProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const del = await PremiumProduct.findByIdAndDelete(id).lean();
    if (!del) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Error deleting product', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// LIST premium products with filtering - UPDATED with status filtering
export const listPremiumProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      searchQuery,
      minPrice,
      maxPrice,
      platform,
      duration,
      licenseType,
      tags,
      status,
    } = req.query;

    // Base query - only show active products in listings
    const query = { 
      type: 'premium_account',
      status: 'active'  // Only show active products in listings
    };

    // Search Query
    if (searchQuery) {
      query.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { platform: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    // Price Range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Platform filter
    if (platform) {
      const platformsArray = platform.split(',').map(p => new RegExp(p.trim(), 'i'));
      query.platform = { $in: platformsArray };
    }

    // Duration filter
    if (duration) {
      const durationsArray = duration.split(',').map(d => new RegExp(d.trim(), 'i'));
      query.duration = { $in: durationsArray };
    }

    // License Type filter
    if (licenseType) {
      const licenseTypesArray = licenseType.split(',').map(lt => new RegExp(lt.trim(), 'i'));
      query.licenseType = { $in: licenseTypesArray };
    }

    // Tags filter
    if (tags) {
      const tagsArray = tags.split(',').map(t => new RegExp(t.trim(), 'i'));
      query.tags = { $in: tagsArray };
    }

    // Override status filter if explicitly provided (for admin purposes)
    if (status && status !== 'active') {
      query.status = status.toLowerCase();
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const products = await PremiumProduct.find(query)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalResults = await PremiumProduct.countDocuments(query);
    const totalPages = Math.ceil(totalResults / limitNum);

    res.status(200).json({
      products,
      page: pageNum,
      limit: limitNum,
      total: totalResults,
      totalPages,
    });

  } catch (err) {
    console.error('Error listing premium products:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};