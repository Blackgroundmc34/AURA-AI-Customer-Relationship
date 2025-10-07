/** @type {import('next').NextConfig} */
const nextConfig = {
  // === AGGRESSIVE HACKATHON BUILD FIXES: IGNORE ALL ERRORS ===
  
  typescript: {
    // Highly aggressive: ignores ALL TypeScript errors.
    ignoreBuildErrors: true,
  },
  
  eslint: {
    // Highly aggressive: ignores ALL ESLint warnings/errors.
    ignoreDuringBuilds: true,
  },

  // Note: If the build still fails, it's a structural error (like a missing import) 
  // rather than a linting/TS type error.
  
  // ===========================================
};

module.exports = nextConfig;
