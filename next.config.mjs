/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sem ignoreBuildErrors: o build falha se os tipos falharem, de propósito.
  images: { unoptimized: true },
}

export default nextConfig
