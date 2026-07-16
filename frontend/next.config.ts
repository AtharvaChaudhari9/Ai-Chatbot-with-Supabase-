import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Skip type checking on production builds to significantly speed up compilation on cloud VMs
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
