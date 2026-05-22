import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@cfo/ui', '@cfo/shared', '@cfo/database'],
    outputFileTracingRoot: path.join(__dirname, '../../'),
    experimental: {
        // Server Actions are stable in Next 15 but keep typedRoutes off
        // until we have time to deal with the generated link types.
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'res.cloudinary.com' },
            { protocol: 'https', hostname: '**.supabase.co' },
        ],
    },
};

export default nextConfig;
