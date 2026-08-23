import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @reown/appkit-adapter-ethers pulls in Coinbase Smart Wallet support
  // (@base-org/account -> @coinbase/cdp-sdk) for its x402 payment feature,
  // which this UI doesn't use (only address + sendTransaction). cdp-sdk's
  // dynamic import()s of its optional @x402/* peer deps (never installed -
  // marked optional in cdp-sdk's own package.json) get statically resolved
  // during SSR bundling otherwise, which breaks the build/page. Marking
  // these external skips bundling them for the server and lets Node's own
  // resolution (which tolerates a rejected optional dynamic import) handle
  // it instead.
  serverExternalPackages: ["@coinbase/cdp-sdk", "@base-org/account"],
};

export default nextConfig;
