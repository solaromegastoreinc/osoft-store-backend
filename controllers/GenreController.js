// backend/controllers/genreController.js

import Genre from '../models/Genre.js'; // Import the new Genre model

/**
 * @desc Get all genres
 * @route GET /api/genres
 * @access Public
 */
export const getAllGenres = async (req, res) => {
  try {
    const genres = await Genre.find({}); // Fetch all genres from the database
    res.status(200).json({
      success: true,
      count: genres.length,
      genres,
    });
  } catch (error) {
    console.error(`Error fetching all genres: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch genres.',
      error: error.message,
    });
  }
};

/**
 * @desc Get a single genre by name
 * @route GET /api/genres/:name
 * @access Public
 *
 * @param {string} req.params.name - The name of the genre to fetch
 */
export const getGenreByName = async (req, res) => {
  try {
    const { name } = req.params;

    // Find a genre by its name.
    // Using a case-insensitive regex for robustness, as URLs can sometimes change casing.
    const genre = await Genre.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

    if (!genre) {
      return res.status(404).json({
        success: false,
        message: `Genre with name "${name}" not found.`,
      });
    }

    res.status(200).json({
      success: true,
      genre,
    });
  } catch (error) {
    console.error(`Error fetching genre by name (${req.params.name}): ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch genre.',
      error: error.message,
    });
  }
};