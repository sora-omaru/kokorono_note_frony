import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // コールバックURLの一時認証コードを開発ログへ出さない。
    incomingRequests: { ignore: [/\/oauth\/callback/] },
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
