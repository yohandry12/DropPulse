import crypto from "crypto";
import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { presignUpload, publicUrl } from "../storage/s3.js";

// Image upload is a two-step, browser-direct flow: the client asks for a
// presigned PUT URL here, then uploads the file straight to MinIO. The backend
// never proxies the bytes. Only Droppers/Admins (who create drops) may upload.

export const uploadRouter = Router();

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

uploadRouter.post(
  "/uploads/presign",
  requireAuth,
  requireRole("DROPPER"),
  async (req, res) => {
    const { contentType } = req.body ?? {};
    const ext = typeof contentType === "string" ? ALLOWED_TYPES[contentType] : undefined;
    if (!ext) {
      res.status(400).json({ error: "unsupported_content_type" });
      return;
    }

    // Opaque random key under a products/ prefix. The client echoes this key
    // back in POST /products; the landing serves the image at its public URL.
    const key = `products/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await presignUpload(key, contentType);

    res.json({ key, uploadUrl, publicUrl: publicUrl(key) });
  }
);
