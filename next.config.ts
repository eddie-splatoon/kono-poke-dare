import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages で https://eddie-splatoon.github.io/kono-poke-dare/ に公開する。
  output: "export",
  basePath: "/kono-poke-dare",
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
