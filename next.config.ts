import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["hudsonkit", "studio"],
  serverExternalPackages: ["@earendil-works/pi-ai"],
  turbopack: {
    root: join(__dirname, ".."),
  },
};

export default nextConfig;
