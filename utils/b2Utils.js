// backend/utils/b2Utils.js
import B2 from "backblaze-b2";
import dotenv from "dotenv";
dotenv.config();

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APP_KEY,
});

/**
 * generateDownloadUrl
 * @param {{ fileName: string, bucketId?: string }} fileInfo
 * @param {number} validDurationInSeconds
 * @returns {string} signed public URL (short-lived)
 */
export async function generateDownloadUrl(fileInfo, validDurationInSeconds = 60 * 60) {
  if (!fileInfo || !fileInfo.fileName) {
    throw new Error("fileInfo.fileName is required");
  }

  // Ensure we're authorized and get the downloadUrl from Backblaze
  const authRes = await b2.authorize();
  // SDK responses vary slightly; try common places
  const downloadUrl =
    authRes?.data?.downloadUrl ||
    authRes?.downloadUrl ||
    b2?.downloadUrl ||
    process.env.B2_DOWNLOAD_URL ||
    process.env.B2_PUBLIC_URL;

  if (!downloadUrl) {
    throw new Error("Could not determine Backblaze downloadUrl (call b2.authorize()).");
  }

  const bucketId = fileInfo.bucketId || process.env.B2_BUCKET_ID;
  if (!bucketId) throw new Error("bucketId is required (fileInfo.bucketId or B2_BUCKET_ID)");

  // Request a download authorization token scoped to the exact file (use fileNamePrefix)
  const authTokenRes = await b2.getDownloadAuthorization({
    bucketId,
    fileNamePrefix: fileInfo.fileName,
    validDurationInSeconds,
    // optionally: responseHeaders: fileInfo.responseHeaders
  });

  const token = authTokenRes?.data?.authorizationToken || authTokenRes?.authorizationToken;
  if (!token) throw new Error("Could not obtain download authorization token from B2");

  // Build URL with proper encoding of path segments
  const segments = fileInfo.fileName.split("/").map(encodeURIComponent).join("/");
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) throw new Error("B2_BUCKET_NAME is required in env");

  // downloadUrl already includes protocol + host (eg https://f001.backblazeb2.com)
  const url = `${downloadUrl.replace(/\/$/, "")}/file/${bucketName}/${segments}?Authorization=${token}`;

  return url;
}
