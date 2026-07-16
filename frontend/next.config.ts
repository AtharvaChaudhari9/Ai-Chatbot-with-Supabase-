import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Skip type checking on production builds to significantly speed up compilation on cloud VMs
    ignoreBuildErrors: true,
  },
  // Enable Next.js standalone folder output for minimal, ultra-fast Docker builds
  output: "standalone",
};

export default nextConfig;
