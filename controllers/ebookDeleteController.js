// backend/controllers/ebookDeleteController.js
import { Ebook } from '../models/Ebook.js';
import { v2 as cloudinary } from 'cloudinary';
import B2 from 'backblaze-b2';

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APP_KEY
});

export const deleteEbook = async (req, res) => {
    try {
        const ebook = await Ebook.findById(req.params.id);
        if (!ebook) return res.status(404).json({ error: 'Not found' });

        // delete thumbnail
        if (ebook.thumbnailPublicId) {
            await cloudinary.uploader.destroy(ebook.thumbnailPublicId);
        }
        // delete ebook file
        if (ebook.fileInfo?.fileId && ebook.fileInfo?.fileName) {
            await b2.authorize();
            await b2.deleteFileVersion({
                fileName: ebook.fileInfo.fileName,
                fileId: ebook.fileInfo.fileId
            });
        }
        await ebook.remove();
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};