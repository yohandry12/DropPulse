import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Config } from "../config.js";

const credentials = {
  accessKeyId: s3Config.accessKey,
  secretAccessKey: s3Config.secretKey,
};

// Client used for presigning ONLY. Points at the PUBLIC endpoint on purpose:
// SigV4 signs the host, and getSignedUrl does no network I/O (pure crypto), so
// the signed URL must already carry the host the browser will hit — no post-hoc
// host swap that would break the signature. forcePathStyle: MinIO serves
// buckets as path segments, not virtual-hosted subdomains.
const presignClient = new S3Client({
  endpoint: s3Config.publicEndpoint,
  region: s3Config.region,
  forcePathStyle: true,
  credentials,
});

// Mint a short-lived presigned PUT URL the browser uses to upload directly to
// MinIO, bypassing the backend.
export async function presignUpload(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(presignClient, command, { expiresIn: 300 });
}

// The stable public URL an uploaded object is served at (bucket is public-read).
export function publicUrl(key: string): string {
  return `${s3Config.publicEndpoint}/${s3Config.bucket}/${key}`;
}
