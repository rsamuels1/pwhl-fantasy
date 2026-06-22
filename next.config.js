/** @type {import('next').NextConfig} */
const nextConfig = {
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
