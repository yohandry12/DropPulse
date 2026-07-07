export function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Only vars every entrypoint (server + worker) always needs are read eagerly.
// JWT secrets are validated lazily by the auth layer so the worker — which has
// no JWT — never fails on them.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  holdTtlMinutes: Number(process.env.HOLD_TTL_MINUTES ?? 10),
  cronIntervalSeconds: Number(process.env.CRON_INTERVAL_SECONDS ?? 30),
};

// Object storage (MinIO in dev, any S3-compatible in prod). Two endpoints:
// `endpoint` is where the backend reaches MinIO (the docker-internal host);
// `publicEndpoint` is baked into presigned URLs the BROWSER hits, so it must be
// a host the browser can resolve (localhost, not the compose service name).
export const s3Config = {
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  accessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
  secretKey: process.env.S3_SECRET_KEY ?? "minioadmin",
  bucket: process.env.S3_BUCKET ?? "drops",
};
