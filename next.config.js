/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf2pic", "sharp"],
  },
};

module.exports = nextConfig;
