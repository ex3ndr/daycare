const isStaticExport = process.env.DAYCARE_DASHBOARD_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? "export" : undefined,
  // Exclude TS route handlers during export builds; the plugin provides /api proxying.
  pageExtensions: isStaticExport ? ["tsx", "jsx"] : ["tsx", "jsx", "ts", "js"]
};

export default nextConfig;
