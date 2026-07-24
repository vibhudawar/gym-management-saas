import type { NextConfig } from "next";

// Pin the workspace root to this project. A stray package-lock.json in a
// parent directory otherwise makes Next infer the wrong Turbopack root.
// process.cwd() is the directory `next` is run from (the project root).
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
