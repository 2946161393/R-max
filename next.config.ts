import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Turbopack infers it by walking up looking for a
  // lockfile, and a stray package.json in the user's home directory — easy to
  // create by running `npm install` in the wrong terminal — wins that search.
  // Module resolution then starts one level ABOVE this project, and
  // `Can't resolve 'tailwindcss'` appears with no obvious cause. Hit for real
  // on 2026-08-05.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // ── OPEN THE DEV SERVER ON http://localhost:3000, NOT ON THE LAN IP ──
  //
  // Next's dev server refuses cross-origin requests for /_next/* resources.
  // Reaching it on a non-localhost address — the WSL bridge, a container's
  // network address, whatever is printed as "Network:" at startup — still
  // serves the HTML but 403s the HMR websocket, and under Next 16 + Turbopack
  // the page then never finishes hydrating. The result is a page that LOOKS
  // completely normal and is entirely dead: no button on it does anything.
  // It reads as a broken component. It is an origin check.
  //
  // The only console evidence is this line, repeated:
  //
  //   WebSocket connection to 'ws://<ip>:3000/_next/webpack-hmr' failed:
  //   Error during WebSocket handshake: Unexpected response code: 403
  //
  // MEASURED — same server, same commit, two addresses:
  //
  //   http://localhost:3104    language toggle works, whole page interactive
  //   http://192.0.2.2:3104    nothing responds, not even "Sign in"
  //
  // The list below silences the startup warning for LAN origins and is worth
  // keeping. Be clear about what it does NOT do: adding the exact address did
  // not restore hydration in testing. localhost is the supported path — if the
  // browser cannot reach localhost directly, port-forward to it rather than
  // browsing the IP.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.local",
    "192.168.*.*",
    "172.*.*.*",
    "10.*.*.*",
  ],
};

export default nextConfig;
