import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Pre-route-groups auth URL — keep old links and emails working.
    return [
      { source: "/login", destination: "/sign-in", permanent: true },
      // The workspace home has been /workbooks and then /studio.
      { source: "/workbooks", destination: "/workspace", permanent: true },
      { source: "/studio", destination: "/workspace", permanent: true },
      // Templates became the community feed; each template keeps its own page.
      { source: "/templates", destination: "/community", permanent: false },
    ];
  },
};

export default nextConfig;
