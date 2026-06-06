import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https:; script-src 'self' 'unsafe-inline' https://translate.google.com https://translate.googleapis.com https://www.gstatic.com https://www.youtube.com; style-src 'self' 'unsafe-inline' https:; frame-src 'self' https://www.youtube.com https://translate.google.com;",
          },
        ],
      },
    ];
  },
  ...(process.env.NODE_ENV === "development"
    ? { allowedDevOrigins: ["192.168.200.102","*.trycloudflare.com","mystery-governance-truck-called.trycloudflare.com"] }
    : {}),
};

export default nextConfig;
