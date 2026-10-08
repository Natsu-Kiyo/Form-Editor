import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @node-rs/argon2 带平台原生二进制，不能让打包器把它打包进 bundle
  serverExternalPackages: ['@node-rs/argon2'],
};

export default nextConfig;
