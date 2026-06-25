/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent @prisma/client from being bundled into Edge Runtime (middleware).
  // Prisma uses eval("__dirname") to locate its query engine binary, which throws
  // ReferenceError in Vercel's Edge Runtime. Externalizing it for the edge runtime
  // ensures webpack never includes it in the middleware bundle.
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@prisma/client",
        ".prisma/client",
      ];
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "fantasy.dykedb.org" }],
        destination: "/beta",
        permanent: false,
      },
    ];
  },
};
module.exports = nextConfig;
