import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp"],
  agentRules: false,
  devIndicators: false,
};
export default nextConfig;
