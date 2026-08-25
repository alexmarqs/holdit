import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "t0.gstatic.com", pathname: "/faviconV2" }],
  },
  typedRoutes: true,
};

export default config;
