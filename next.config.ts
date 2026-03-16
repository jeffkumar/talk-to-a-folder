import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingIncludes: {
    // Ensure PDF.js worker file is present in the serverless bundle (used for server-side PDF ingestion).
    // Also include Reducto schema files for structured document extraction.
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./schemas/reducto/*.json",
    ],
  },
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
