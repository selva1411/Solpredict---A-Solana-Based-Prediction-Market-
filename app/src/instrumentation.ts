export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const missingVars: string[] = [];
    const required = [
      ["SESSION_SECRET", "dev-secret-change-in-prod"],
      ["DATABASE_URL"],
      ["HELIUS_WEBHOOK_SECRET"],
    ] as const;

    for (const [key, fallback] of required) {
      if (!process.env[key]) {
        if (fallback && process.env.NODE_ENV !== "production") {
          process.env[key] = fallback;
        } else {
          missingVars.push(key);
        }
      }
    }

    if (missingVars.length > 0 && process.env.NODE_ENV === "production") {
      console.error(
        `[instrumentation] Missing required env vars: ${missingVars.join(", ")}`
      );
    }

    // Ensure WebSocket server (ports 3001 & 8900) is running
    if (process.env.NODE_ENV !== "production") {
      try {
        const http = await import("http");
        const { spawn } = await import("child_process");
        const path = await import("path");

        const checkWsServer = () => {
          return new Promise<boolean>((resolve) => {
            const req = http.get("http://127.0.0.1:3001/health", (res) => {
              resolve(res.statusCode === 200);
            });
            req.on("error", () => resolve(false));
            req.setTimeout(600, () => {
              req.destroy();
              resolve(false);
            });
          });
        };

        const isRunning = await checkWsServer();
        if (!isRunning) {
          const wsScript = path.resolve(process.cwd(), "server/ws-server.ts");
          const child = spawn(
            "node",
            ["--env-file=.env.local", "--import", "tsx", wsScript],
            {
              detached: true,
              stdio: "ignore",
              cwd: process.cwd(),
            }
          );
          child.unref();
          console.log("[instrumentation] Started background ws-server (ports 3001 & 8900)");
        }
      } catch (e) {
        console.warn("[instrumentation] Could not auto-start ws-server:", e);
      }
    }
  }
}

export async function onRequestError(
  err: unknown,
  request: unknown,
  context: unknown
) {
  const { captureException } = await import("@sentry/nextjs");
  captureException(err);
}
