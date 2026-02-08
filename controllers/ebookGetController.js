// backend/controllers/ebooksGetController.js
import ProductModel from '../models/Product.js';

export const getAllEbooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filter for active ebooks only in listings
    const query = { 
      type: 'ebook',
      status: 'active'  // Only show active products
    };

    const [totalItems, ebooks] = await Promise.all([
      ProductModel.countDocuments(query),
      ProductModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      success: true,
      products: ebooks,
      currentPage: page,
      totalPages,
      totalItems,
    });
  } catch (error) {
    console.error('Error fetching paginated ebooks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ebooks' });
  }
};

export const getEbookById = async (req, res) => {
  try {
    // Direct URL access - don't filter by status, allow access to inactive products
    const ebook = await ProductModel.findOne({
      _id: req.params.id,
      type: 'ebook',
      // Removed status filter to allow direct URL access
    });

    if (!ebook) {
      return res.status(404).json({ success: false, message: 'Ebook not found' });
    }

    res.status(200).json({ success: true, ebook });
  } catch (error) {
    console.error('Error fetching ebook by ID:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ebook ID format' });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch ebook' });
  }
};

export const getFilteredAndSearchedEbooks = async (req, res) => {
  try {
    const {
      searchQuery,
      isAvailable,
      language,
      format,
      categories,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const pipeline = [];
    const matchStage = { 
      type: 'ebook',
      status: 'active'  // Only show active products in filtered results
    };

    // Atlas Search Stage
    if (searchQuery) {
      pipeline.push({
        $search: {
          index: 'SearchIndex',
          text: {
            query: searchQuery,
            path: ['name', 'author', 'description', 'tags'],
          },
        },
      });
    }

    // Filtering by isAvailable
    if (isAvailable !== undefined) {
      matchStage.isAvailable = isAvailable === 'true';
    }

    // Filtering by Language
    if (language) {
      const languagesArray = language.split(',').map((lang) => lang.trim());
      matchStage.language = { $in: languagesArray };
    }

    // Filtering by Format
    if (format) {
      const formatsArray = format.split(',').map((f) => f.trim());
      matchStage.deliveryFormat = { $in: formatsArray };
    }

    // Filtering by Categories
    if (categories) {
      const categoriesArray = categories.split(',').map((cat) => cat.trim());
      matchStage.tags = { $in: categoriesArray };
    }

    // Filtering by Price Range
    const priceRange = {};
    const parsedMinPrice = parseFloat(minPrice);
    const parsedMaxPrice = parseFloat(maxPrice);
    if (!isNaN(parsedMinPrice)) {
      priceRange.$gte = parsedMinPrice;
    }
    if (!isNaN(parsedMaxPrice)) {
      priceRange.$lte = parsedMaxPrice;
    }
    if (Object.keys(priceRange).length > 0) {
      matchStage.price = priceRange;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const sortStage = {};
    if (sortBy === 'price') {
      sortStage.price = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'name') {
      sortStage.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'author') {
      sortStage.author = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortStage._id = 1;
    }

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'totalResults' }],
        data: [
          { $sort: sortStage },
          { $skip: skip },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              name: 1,
              author: 1,
              description: 1,
              price: 1,
              thumbnailUrl: 1,
              isAvailable: 1,
              quantityAvailable: 1,
              rating: 1,
              tags: 1,
              language: 1,
              deliveryFormat: 1,
              publisher: 1,
              ISBN: 1,
              publicationDate: 1,
              metadata: 1,
              type: 1,
              status: 1,
            },
          },
        ],
      },
    });

    const [results] = await ProductModel.aggregate(pipeline);

    const ebooks = results.data || [];
    const totalResults = results.metadata[0]?.totalResults || 0;

    res.status(200).json({
      success: true,
      count: ebooks.length,
      totalResults,
      page: parseInt(page),
      limit: parseInt(limit),
      ebooks,
    });
  } catch (error) {
    console.error('Error in getFilteredAndSearchedEbooks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ebooks with applied filters/search.',
      error: error.message,
    });
  }
};

export const getNewestEbooks = async (req, res) => {
  try {
    // Filter for active ebooks only in slider
    const newestEbooks = await ProductModel.find({ 
      type: 'ebook',
      status: 'active'  // Only show active products
    })
      .sort({ publicationDate: -1, createdAt: -1 })
      .limit(8);

    res.status(200).json({ success: true, ebooks: newestEbooks });
  } catch (error) {
    console.error('Error fetching newest ebooks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch newest ebooks' });
  }
};

export const getRandomEbooks = async (req, res) => {
  try {
    // Filter for active ebooks only in slider
    const randomEbooks = await ProductModel.aggregate([
      { $match: { 
        type: 'ebook',
        status: 'active'  // Only show active products
      }},
      { $sample: { size: 8 } },
    ]);

    res.status(200).json({ success: true, ebooks: randomEbooks });
  } catch (error) {
    console.error('Error fetching random ebooks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch random ebooks' });
  }
};