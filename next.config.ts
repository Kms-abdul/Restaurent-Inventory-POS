import type { NextConfig } from "next";
import os from "os";
import dns from "dns";

// Bypass ISP DNS hijacking for Supabase (e.g. ACT Fibernet India) in Node.js
const SUPABASE_HOST = 'jsefqawauiidxrzsvdub.supabase.co';
const CLOUDFLARE_IP = '104.18.38.10';

const origLookup: any = dns.lookup;
(dns as any).lookup = function (hostname: string, options: any, callback: any) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (hostname === SUPABASE_HOST) {
    const res = options?.all ? [{ address: CLOUDFLARE_IP, family: 4 }] : CLOUDFLARE_IP;
    if (typeof callback === "function") {
      return callback(null, res, 4);
    }
    return Promise.resolve(res);
  }
  return origLookup.call(dns, hostname, options, callback);
};

// Automatically include all local network IPv4 addresses and known origins
const networkIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((net): net is os.NetworkInterfaceInfo => Boolean(net && net.family === "IPv4"))
  .map((net) => net.address);

const allowedDevOrigins = Array.from(
  new Set([
    "localhost",
    "127.0.0.1",
    "100.77.205.30",
    "192.168.10.172",
    "192.168.29.224",
    ...networkIps,
    ...networkIps.map((ip) => `${ip}:3000`),
    "100.77.205.30:3000",
  ])
);

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins,
};

export default nextConfig;
