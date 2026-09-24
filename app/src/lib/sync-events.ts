/**
 * Universal cross-page activity synchronization.
 * Dispatches events to the current window, all other open tabs/windows via BroadcastChannel,
 * and calls the backend realtime refresh endpoint to broadcast over WebSockets.
 */

export interface ActivityDetail {
  wallet?: string;
  marketPubkey?: string;
  type?: string;
  signature?: string;
  timestamp?: number;
  [key: string]: unknown;
}

const CHANNEL_NAME = "solpredict_sync";
const EVENT_NAME = "solpredict:activity_updated";

export function notifyAppActivity(detail?: ActivityDetail): void {
  if (typeof window === "undefined") return;

  const payload: ActivityDetail = {
    ...detail,
    timestamp: detail?.timestamp ?? Date.now(),
  };

  // 1. Same-window / same-tab reactive dispatch
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch (err) {
    console.debug("[sync-events] window.dispatchEvent error:", err);
  }

  // 2. Cross-tab instant broadcast via BroadcastChannel
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    }
  } catch (err) {
    console.debug("[sync-events] BroadcastChannel error:", err);
  }

  // 3. Push to backend WebSocket server so all remote clients and sessions get fresh data
  try {
    fetch("/api/realtime/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: payload.wallet ?? null }),
    }).catch(() => null);
  } catch {}
}

export function subscribeAppActivity(
  callback: (detail?: ActivityDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<ActivityDetail>;
    callback(custom.detail);
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event: MessageEvent<ActivityDetail>) => {
        callback(event.data);
      };
    } catch {}
  }

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}
