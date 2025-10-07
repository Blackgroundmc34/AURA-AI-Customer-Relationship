/** @type {import('next').NextConfig} */
const nextConfig = {
  // Option 1: Ignore TypeScript errors during the build
  typescript: {
    // !! DANGER: This is typically used only for temporary fixes. !!
    ignoreBuildErrors: true,
  },
  
  // Option 2: Ignore ESLint warnings/errors during the build
  eslint: {
    // !! DANGER: Use this to suppress linting warnings/errors in the production build. !!
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;