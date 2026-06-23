import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['192.168.7.154'],
};

export default nextConfig;
