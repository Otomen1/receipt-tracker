/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf2pic", "sharp"],
  },
};

module.exports = withPWA(nextConfig);
