import { PublicKey, Cluster } from "@solana/web3.js";
import { logger } from "@/lib/logger";

type ClusterName = "mainnet-beta" | "devnet" | "testnet" | "localnet";

function requiredEnv(name: string, fallback = ""): string {
  const v = process.env[name] ?? fallback;
  if (!v && typeof window !== "undefined") {
    logger.warn(`[ENV] Missing ${name}; using empty fallback`);
  }
  return v;
}

/**
 * Return the base origin the page is being served from, so client endpoints can
 * be resolved at runtime. This makes ONE bundle work from localhost, a LAN IP,
 * or a tunnel URL (ngrok) — baked-in absolute hosts like `172.25.7.63:3000`
 * break the moment the page is opened from any other origin.
 */
function clientOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Is a URL host a localhost / loopback / LAN-style address (i.e. localnet)? */
function isLocalHostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      // Private ranges (RFC 1918) — typical for a LAN/localnet validator.
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    );
  } catch {
    return false;
  }
}

export const ENV = {
  get rpcUrl(): string {
    const configured =
      process.env.NEXT_PUBLIC_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      "https://api.devnet.solana.com";

    // On the client, route through the app's own /api/rpc proxy whenever:
    // 1) The configured endpoint is a local address, OR
    // 2) The configured endpoint is the public, rate-limited devnet endpoint, OR
    // 3) An explicit /api/rpc relative proxy is specified.
    // This utilizes the server proxy's in-memory caching and fallback layer to completely prevent 429 rate limit errors.
    if (typeof window !== "undefined") {
      if (
        isLocalHostUrl(configured) ||
        configured.includes("api.devnet.solana.com") ||
        configured.startsWith("/api/rpc")
      ) {
        return `${clientOrigin()}/api/rpc`;
      }
    }
    return configured;
  },

  /**
   * Server-side only: the REAL validator endpoint, never the `/api/rpc` proxy.
   *
   * Server code (indexers, cron, admin-guard, on-chain verification) must talk
   * directly to the validator, not through an HTTP rewrite meant for browsers.
   * When the configured endpoint is a local/LAN address (localnet) we normalize
   * any `localhost`/`NEXT_PUBLIC_RPC_URL` proxy value to the loopback validator.
   * In production/remote clusters the configured public endpoint is used as-is.
   */
  get serverRpcUrl(): string {
    if (this.isLocalnet) {
      return process.env.LOCALNET_RPC_URL || "http://127.0.0.1:8899";
    }

    const configured =
      process.env.HELIUS_RPC_URL ??
      (process.env.NEXT_PUBLIC_RPC_URL?.startsWith("http") &&
      !process.env.NEXT_PUBLIC_RPC_URL.includes("/api/rpc")
        ? process.env.NEXT_PUBLIC_RPC_URL
        : undefined) ??
      process.env.LOCALNET_RPC_URL ??
      "https://api.devnet.solana.com";

    if (isLocalHostUrl(configured) || configured.includes("/api/rpc")) {
      // Localnet: normalize to the loopback validator, ignoring any browser proxy.
      return process.env.LOCALNET_RPC_URL || "http://127.0.0.1:8899";
    }
    return configured;
  },

  get wsEndpoint(): string | undefined {
    const configured = process.env.NEXT_PUBLIC_WS_ENDPOINT;
    if (configured) {
      if (typeof window !== "undefined" && isLocalHostUrl(configured)) {
        const port = new URL(configured).port || "8900";
        const proto = clientOrigin().startsWith("https") ? "wss" : "ws";
        return `${proto}://${new URL(clientOrigin()).hostname}:${port}`;
      }
      return configured;
    }

    // When running locally, point to the local validator WebSocket port
    if (this.isLocalnet) {
      if (typeof window !== "undefined") {
        const proto = clientOrigin().startsWith("https") ? "wss" : "ws";
        return `${proto}://${new URL(clientOrigin()).hostname}:8900`;
      }
      return process.env.LOCALNET_WS_URL || "ws://127.0.0.1:8900";
    }

    const rawRpc =
      process.env.NEXT_PUBLIC_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      "";

    // If an external custom RPC is configured (e.g. Helius or Quicknode), derive wss:// from it
    if (rawRpc && !rawRpc.includes("/api/rpc") && !isLocalHostUrl(rawRpc)) {
      try {
        const u = new URL(rawRpc);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        return u.toString();
      } catch {}
    }

    // Fall back to the public cluster WebSocket endpoint so @solana/web3.js
    // never attempts to connect to the Next.js /api/rpc HTTP route as a WebSocket.
    if (this.cluster === "devnet") {
      return "wss://api.devnet.solana.com";
    }
    if (this.cluster === "mainnet-beta") {
      return "wss://api.mainnet-beta.solana.com";
    }
    return undefined;
  },

  get heliusApiKey(): string {
    if (typeof window !== "undefined") {
      throw new Error("HELIUS_API_KEY is server-only");
    }
    return process.env.HELIUS_API_KEY ?? "";
  },

  get heliusGrpcUrl(): string {
    if (typeof window !== "undefined") {
      throw new Error("HELIUS_GRPC_URL is server-only");
    }
    return process.env.HELIUS_GRPC_URL ?? "";
  },

  get programId(): PublicKey {
    const id =
      process.env.NEXT_PUBLIC_PROGRAM_ID ??
      "6HWVuwJuRrcynbusE5Av8czLz98WWqBYSYQ2hP2cjHXg";
    return new PublicKey(id);
  },

  get pythProgramId(): PublicKey {
    const id =
      process.env.NEXT_PUBLIC_PYTH_PROGRAM_ID ??
      "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
    return new PublicKey(id);
  },

  get pythHermesUrl(): string {
    return (
      process.env.NEXT_PUBLIC_PYTH_HERMES_URL ?? "https://hermes.pyth.network"
    );
  },

  get cluster(): Cluster {
    const c = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as ClusterName;
    if (c === "localnet") return "devnet";
    return c as Cluster;
  },

  get isProd(): boolean {
    return this.cluster === "mainnet-beta";
  },

  get isLocalnet(): boolean {
    return (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") === "localnet";
  },

  get usdcMint(): PublicKey {
    // Only mainnet and devnet have a canonical, widely-deployed USDC mint.
    // Testnet has no standard USDC deployment — returning a fake address there
    // would silently break any USDC-denominated flow, so fail loudly instead.
    const c = this.cluster;
    if (c === "mainnet-beta") {
      return new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    }
    if (c === "devnet") {
      return new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    }
    throw new Error(
      `No canonical USDC mint exists on cluster "${c}". Configure a USDC mint explicitly or run on devnet/mainnet.`
    );
  },
};
