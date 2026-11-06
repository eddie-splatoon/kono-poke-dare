import type { NextConfig } from "next";

// GitHub Pages で https://eddie-splatoon.github.io/kono-poke-dare/ に公開する。
const basePath = "/kono-poke-dare";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // /about を about/index.html に出力する。既定の about.html では、プリフェッチ用の
  // about/ ディレクトリと名前が重なり、/about の解決先が配信側の動作に左右される。
  trailingSlash: true,
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
