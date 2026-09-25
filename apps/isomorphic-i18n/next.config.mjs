/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN:
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.VITE_MAPBOX_TOKEN ?? '',
  },
  reactStrictMode: true,
  transpilePackages: ["@workspace/ui"],
  webpack: (config) => {
    // packages/api compiles the reset-password email with handlebars.
    // https://github.com/handlebars-lang/handlebars.js/issues/1174#issuecomment-229918935
    config.resolve.alias.handlebars = 'handlebars/dist/handlebars.min.js'
    return config
  },
};

export default nextConfig;
