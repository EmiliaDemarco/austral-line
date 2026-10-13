import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ponytail: sin cacheComponents a propósito, todo dinámico = menos conceptos para el curso
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
