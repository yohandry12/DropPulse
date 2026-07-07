import "./loadEnv.js";
import { createApp } from "./app.js";
import { config, s3Config } from "./config.js";
import { banner, log } from "./logger.js";

const app = createApp();

app.listen(config.port, () => {
  banner("DropPulse API", [
    ["env", process.env.NODE_ENV ?? "development"],
    ["port", String(config.port)],
    ["health", `http://localhost:${config.port}/health`],
    ["storage", s3Config.publicEndpoint],
    ["bucket", s3Config.bucket],
  ]);
  log.ok("Ready — waiting for requests");
});
