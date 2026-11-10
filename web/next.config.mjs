import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: root,
  transpilePackages: ["@inviteme/shared"],
  // Il frontend inoltra /api all'API e di base taglia i corpi oltre 10 MB: ZIP dei temi, video e brani sono più grandi.
  // Stesso limite di nginx (client_max_body_size 160m).
  experimental: { middlewareClientMaxBodySize: "160mb" },
  // Il frontend inoltra /api/* all'API: stessa origine per il browser, quindi cookie di sessione semplici.
  // Le immagini dello stock non cambiano: il browser le tiene una settimana invece di riscaricarle a ogni visita.
  async headers() {
    return [{ source: "/stock/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
