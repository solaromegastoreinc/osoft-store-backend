// File: backend/controllers/ebookAddController.js
import { Ebook } from '../models/Ebook.js';

export const createEbook = async (req, res) => {
  try {
    const {
      name, slug, description, price, isAvailable, status,
      tags, language, thumbnailUrl, deliveryFormat, fileInfo,
      author, ISBN, publicationDate, publisher, edition, metadata
    } = req.body;

    // Validate required fields
    if (!name || !slug || !price || !author) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ebook = new Ebook({
      name,
      slug,
      description,
      price,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      status: status || 'active',
      tags,
      language,
      thumbnailUrl,
       thumbnailPublicId: thumbnailUrl ? thumbnailUrl.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, "") : undefined,
      deliveryFormat: deliveryFormat || 'email',
      fileInfo: {
        fileId: fileInfo.fileId,
        fileName: fileInfo.fileName,
        bucketId: fileInfo.bucketId
      },
      author,
      ISBN,
      publicationDate: publicationDate ? new Date(publicationDate) : null,
      publisher,
      edition,
      metadata: metadata ? {
        pageCount: metadata.pageCount,
        fileSize: metadata.fileSize,
        fileFormat: metadata.fileFormat
      } : null
    });

    await ebook.save();
    res.status(201).json(ebook);
  } catch (error) {
    // Move error handling INSIDE the catch block
    if (error.code === 11000 && error.keyPattern?.slug) {
      return res.status(400).json({
        error: 'Slug must be unique'
      });
    }
    
    res.status(400).json({ 
      message: error.message || 'Error creating ebook',
      errors: error.errors 
    });
  }
};