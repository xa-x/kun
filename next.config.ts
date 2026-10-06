import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Pre-route-groups auth URL — keep old links and emails working.
    return [{ source: "/login", destination: "/sign-in", permanent: true }];
  },
};

export default nextConfig;
