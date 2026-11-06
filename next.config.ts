import type { NextConfig } from "next";

// GitHub Pages で https://eddie-splatoon.github.io/kono-poke-dare/ に公開する。
const basePath = "/kono-poke-dare";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // public/ のファイルの URL は basePath を自動で補わないので、コードに渡す。
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
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
