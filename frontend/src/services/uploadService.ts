import axios from "axios";
import { httpClient } from "./httpClient";

// Two-step browser-direct image upload. Ask the backend for a presigned PUT URL
// (POST /uploads/presign), then PUT the file straight to MinIO — the backend
// never proxies the bytes. Returns the object key to store on the drop.

interface PresignResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

// Content types the backend accepts (backend/src/uploads/routes.ts ALLOWED_TYPES).
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Upload a file, return { key, publicUrl }. Throws on network / rejected type.
export async function uploadImage(
  file: File,
): Promise<{ key: string; publicUrl: string }> {
  const { data } = await httpClient.post<PresignResponse>("/uploads/presign", {
    contentType: file.type,
  });

  // PUT the raw bytes to the presigned URL. Bare axios (absolute signed URL, no
  // /api prefix, no auth header — the signature IS the auth). Content-Type must
  // match what was signed.
  await axios.put(data.uploadUrl, file, {
    headers: { "Content-Type": file.type },
  });

  return { key: data.key, publicUrl: data.publicUrl };
}
