const e2eDistDir = process.env.DAOFLOW_E2E_DIST_DIR === 'output/playwright/.next-e2e'
  ? 'output/playwright/.next-e2e'
  : '.next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Playwright's development server must never replace the standalone build
  // that a parallel local-runtime verification is serving.
  distDir: e2eDistDir,
};

export default nextConfig;
