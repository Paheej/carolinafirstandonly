/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@cfo/shared', '@cfo/database'],
};

export default nextConfig;
