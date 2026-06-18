import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  webpack: (config) => {
    // Transformers.js / onnxruntime-web reference Node built-ins that don't
    // exist in the browser or inference worker; stub them out.
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
