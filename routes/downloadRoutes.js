// backend/routes/downloadRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { generateDownloadUrl } from "../utils/b2Utils.js";

dotenv.config();

const router = express.Router();

// GET /api/download/:token
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const payload = jwt.verify(token, process.env.DOWNLOAD_JWT_SECRET); // { fileName, displayName, orderId, exp }
    const fileName = payload.fileName;
    const displayName = payload.displayName || fileName.split("/").pop();

    // Build response headers you want served by B2
    const responseHeaders = {
      "Content-Disposition": `attachment; filename="${displayName}"`,
    };

  const downloadUrl = await generateDownloadUrl(
  { fileName, bucketId: payload.bucketId || process.env.B2_BUCKET_ID },
  60 * 60
);

    // Redirect the client to the signed B2 URL (fast, scalable)
    return res.redirect(downloadUrl);
  } catch (err) {
    console.error("Download error:", err);
    return res.status(401).send("Invalid or expired link.");
  }
});

export default router;