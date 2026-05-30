import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["hudsonkit", "studio"],
  serverExternalPackages: ["@earendil-works/pi-ai"],
  turbopack: {
    root: join(__dirname, ".."),
  },
};

export default nextConfig;
