import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/export": ["./public/fonts/Kanit-Regular.ttf"],
  },
};
export default config;
