import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship as a fully static site: the page host (Vercel / Cloudflare Pages) only
  // serves static assets. Signaling + presence live on a separate Cloudflare
  // Worker (see `worker/`), and model weights are fetched straight from the
  // Hugging Face CDN — so nothing of ours is in the signaling or data path.
  output: "export",
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
