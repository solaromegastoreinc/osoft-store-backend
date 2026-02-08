// backend/controllers/ebookUpdateController.js
import { Ebook } from '../models/Ebook.js';
import { v2 as cloudinary } from 'cloudinary';
import B2 from 'backblaze-b2';
import path from 'path';
import stream from 'stream';

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APP_KEY
});

export const updateEbook = async (req, res) => {
    try {
        const { id } = req.params;
        const ebook = await Ebook.findById(id);
        if (!ebook) return res.status(404).json({ error: 'Not found' });

        // 1) Handle thumbnail upload
        if (req.files?.thumbnail?.[0]) {
            const thumbFile = req.files.thumbnail[0];

            try {
                console.log('Existing thumbnailPublicId:', ebook.thumbnailPublicId);

                // Delete old thumbnail if exists
                if (ebook.thumbnailPublicId) {
                    try {
                        await cloudinary.uploader.destroy(ebook.thumbnailPublicId, { invalidate: true });
                        console.log('Deleted old thumbnail:', ebook.thumbnailPublicId);
                    } catch (err) {
                        console.warn('Could not delete old thumbnail:', err.message);
                    }
                }

                // Prepare upload options
                const uploadOptions = {
                    transformation: [{ width: 500, height: 500, crop: 'limit' }],
                    folder: 'ebook-thumbnails',
                    overwrite: true,
                    invalidate: true
                };

                // If we had a previous thumbnail, re-use its ID to maintain consistent public_id
                if (ebook.thumbnailPublicId) {
                    const existingId = ebook.thumbnailPublicId.split('/').pop(); // strip folder
                    uploadOptions.public_id = existingId;
                }

                console.log('Uploading new thumbnail with options:', uploadOptions);

                const thumbRes = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        uploadOptions,
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );

                    const bufferStream = new stream.PassThrough();
                    bufferStream.end(thumbFile.buffer);
                    bufferStream.pipe(uploadStream);
                });

                console.log('New thumbnail uploaded:', thumbRes.public_id);

                // Update DB with new thumbnail info
                ebook.thumbnailUrl = thumbRes.secure_url;
                ebook.thumbnailPublicId = thumbRes.public_id;
                console.log('Thumbnail info updated in DB');
            } catch (err) {
                console.error('Thumbnail upload failed', err);
                return res.status(500).json({ error: 'Thumbnail upload failed' });
            }
        }


        // 2) Handle ebook file upload
        if (req.files?.ebook?.[0]) {
            const ebookFile = req.files.ebook[0];

            try {
                await b2.authorize();

                // Delete old file if exists
                if (ebook.fileInfo?.fileId) {
                    try {
                        await b2.deleteFileVersion({
                            fileId: ebook.fileInfo.fileId,
                            fileName: ebook.fileInfo.fileName
                        });
                    } catch (deleteErr) {
                        console.warn('Could not delete old ebook file', deleteErr);
                    }
                }

                // Upload new file
                const upUrl = await b2.getUploadUrl({ bucketId: process.env.B2_BUCKET_ID });
                const ext = path.extname(ebookFile.originalname);
                const remoteName = `ebooks/${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;

                const upRes = await b2.uploadFile({
                    uploadUrl: upUrl.data.uploadUrl,
                    uploadAuthToken: upUrl.data.authorizationToken,
                    fileName: remoteName,
                    data: ebookFile.buffer,
                    mime: ebookFile.mimetype
                });

                ebook.fileInfo = {
                    fileId: upRes.data.fileId,
                    fileName: remoteName,
                    bucketId: process.env.B2_BUCKET_ID
                };

                // You can optionally auto-set file size and format here too
                ebook.metadata = ebook.metadata || {};
                ebook.metadata.fileSize = Math.round(ebookFile.size / 1024); // size in KB
                ebook.metadata.fileFormat = path.extname(ebookFile.originalname).substring(1).toLowerCase(); // e.g. 'pdf'
            
            } catch (err) {
                console.error('Ebook file upload failed', err);
                return res.status(500).json({ error: 'Ebook file upload failed' });
            }
        }

        // 3) Update other fields
        const updateFields = [
            'name', 'slug', 'description', 'price', 'isAvailable',
            'status', 'tags', 'language', 'author', 'ISBN',
            'publicationDate', 'publisher', 'edition'
        ];

        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                ebook[field] = req.body[field];
            }
        });

        // 4) Handle metadata separately
        ebook.metadata = ebook.metadata || {};

        if (req.body['metadata[pageCount]'] !== undefined) {
            ebook.metadata.pageCount = parseInt(req.body['metadata[pageCount]'], 10);
        }

        if (req.body['metadata[fileSize]'] !== undefined) {
            ebook.metadata.fileSize = parseInt(req.body['metadata[fileSize]'], 10);
        }

        if (req.body['metadata[fileFormat]'] !== undefined) {
            ebook.metadata.fileFormat = req.body['metadata[fileFormat]'];
        }

        const saved = await ebook.save();
        res.json(saved);
    } catch (err) {
        console.error('General update error', err);
        res.status(500).json({
            error: 'Internal server error',
            details: err.message
        });
    }
};