"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  Power,
  PowerOff,
  UserPlus,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { getConfigPda, getEmergencyPausePda } from "@/lib/pda";
import { txAccounts, sendWithRetry } from "@/lib/anchor-utils";
import { PublicKey, SystemProgram } from "@solana/web3.js";

interface Setting {
  key: string;
  value: string;
  label: string;
  description: string;
  type: "text" | "number" | "boolean";
}

const SETTING_METADATA: Record<
  string,
  { label: string; description: string; type: "text" | "number" | "boolean" }
> = {
  feeBps: {
    label: "Trading Fee (bps)",
    description: "200 = 2%. Platform fee on each trade.",
    type: "number",
  },
  platformName: {
    label: "Platform Name",
    description: "Display name shown in the header.",
    type: "text",
  },
  maintenanceMode: {
    label: "Maintenance Mode",
    description: "Pause all trading (true/false).",
    type: "boolean",
  },
  maxMarketDuration: {
    label: "Max Market Duration (s)",
    description: "Maximum duration for new markets in seconds.",
    type: "number",
  },
  minLiquiditySol: {
    label: "Min Liquidity (SOL)",
    description: "Minimum liquidity required to create a market.",
    type: "number",
  },
  resolutionDelaySec: {
    label: "Resolution Delay (s)",
    description: "Delay after endTs before market can be resolved.",
    type: "number",
  },
  disputePeriodSec: {
    label: "Dispute Period (s)",
    description: "Time window for users to dispute a resolution.",
    type: "number",
  },
  adminWallet: {
    label: "Admin Wallet",
    description: "Authorized admin wallet address.",
    type: "text",
  },
  minMarketDuration: {
    label: "Min Market Duration (s)",
    description: "Minimum duration for new markets in seconds.",
    type: "number",
  },
  twitterShareEnabled: {
    label: "Twitter Share Enabled",
    description: "Allow tweet-to-share of outcomes.",
    type: "boolean",
  },
};

export default function AdminSettingsPage() {
  const { program, wallet } = useProgram();
  const { publicKey } = useWallet();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [guardians, setGuardians] = useState<string[]>([]);
  const [requiredConfirmations, setRequiredConfirmations] = useState(1);
  const [newGuardian, setNewGuardian] = useState("");
  const [guardianThreshold, setGuardianThreshold] = useState(1);
  const [guardianLoading, setGuardianLoading] = useState(false);

  useEffect(() => {
    adminFetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const raw: Record<string, string> = data.settings || {};
        const list = Object.entries(raw).map(([key, value]) => ({
          key,
          value,
          label: SETTING_METADATA[key]?.label || key,
          description: SETTING_METADATA[key]?.description || "",
          type: SETTING_METADATA[key]?.type || "text",
        }));
        setSettings(list);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  // Surface on-chain emergency pause state (separate from DB maintenanceMode)
  useEffect(() => {
    if (!program) return;
    let cancelled = false;
    (async () => {
      try {
        const emergencyPda = getEmergencyPausePda(program.programId);
        const accounts = program.account as unknown as {
          emergencyPause: {
            fetch(
              pda: ReturnType<typeof getEmergencyPausePda>
            ): Promise<{ paused: boolean }>;
          };
        };
        const acc = await accounts.emergencyPause
          .fetch(emergencyPda)
          .catch(() => null);
        if (!cancelled) setPaused(!!acc?.paused);
      } catch {
        if (!cancelled) setPaused(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [program]);

  // Fetch the on-chain guardian set + required confirmations. The account may
  // not exist yet (created lazily on first pause/add-guardian) — treat a
  // missing account as "admin is the only guardian, threshold 1".
  const fetchGuardians = async () => {
    if (!program) return;
    try {
      const emergencyPda = getEmergencyPausePda(program.programId);
      const accounts = program.account as unknown as {
        emergencyPause: {
          fetch(pda: ReturnType<typeof getEmergencyPausePda>): Promise<{
            paused: boolean;
            guardians: PublicKey[];
            requiredConfirmations: number;
          }>;
        };
      };
      const acc = await accounts.emergencyPause
        .fetch(emergencyPda)
        .catch(() => null);
      if (!acc) {
        setGuardians(publicKey ? [publicKey.toBase58()] : []);
        setRequiredConfirmations(1);
        setGuardianThreshold(1);
        return;
      }
      const active = acc.guardians
        .map((g) => g.toBase58())
        .filter((b58: string) => b58 !== PublicKey.default.toBase58());
      setGuardians(active);
      setRequiredConfirmations(acc.requiredConfirmations);
      setGuardianThreshold(acc.requiredConfirmations);
    } catch {
      // non-critical — the section renders with whatever state we have
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, [program, publicKey]);

  const handleAddGuardian = async () => {
    if (!program || !publicKey) {
      toast.error("Connect an admin wallet first");
      return;
    }
    let parsed: PublicKey;
    try {
      parsed = new PublicKey(newGuardian.trim());
    } catch {
      toast.error("Invalid public key");
      return;
    }
    setGuardianLoading(true);
    try {
      const configPda = getConfigPda(program.programId);
      const emergencyPda = getEmergencyPausePda(program.programId);
      const builder = program.methods.addGuardian(parsed).accounts(
        txAccounts({
          admin: publicKey,
          config: configPda,
          emergencyPause: emergencyPda,
          systemProgram: SystemProgram.programId,
        })
      );
      await sendWithRetry(program, builder);
      toast.success("Guardian added on-chain");
      setNewGuardian("");
      fetchGuardians();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add guardian"
      );
    } finally {
      setGuardianLoading(false);
    }
  };

  const handleRemoveGuardian = async (guardianB58: string) => {
    if (!program || !publicKey) {
      toast.error("Connect an admin wallet first");
      return;
    }
    setGuardianLoading(true);
    try {
      const configPda = getConfigPda(program.programId);
      const emergencyPda = getEmergencyPausePda(program.programId);
      const builder = program.methods
        .removeGuardian(new PublicKey(guardianB58))
        .accounts(
          txAccounts({
            admin: publicKey,
            config: configPda,
            emergencyPause: emergencyPda,
            systemProgram: SystemProgram.programId,
          })
        );
      await sendWithRetry(program, builder);
      toast.success("Guardian removed on-chain");
      fetchGuardians();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove guardian"
      );
    } finally {
      setGuardianLoading(false);
    }
  };

  const handleSetThreshold = async (threshold: number) => {
    if (!program || !publicKey) {
      toast.error("Connect an admin wallet first");
      return;
    }
    setGuardianLoading(true);
    try {
      const configPda = getConfigPda(program.programId);
      const emergencyPda = getEmergencyPausePda(program.programId);
      const builder = program.methods.setGuardianThreshold(threshold).accounts(
        txAccounts({
          admin: publicKey,
          config: configPda,
          emergencyPause: emergencyPda,
          systemProgram: SystemProgram.programId,
        })
      );
      await sendWithRetry(program, builder);
      toast.success(`Unpause threshold set to ${threshold}`);
      fetchGuardians();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to set threshold"
      );
    } finally {
      setGuardianLoading(false);
    }
  };

  const handleEmergencyPause = async (pause: boolean) => {
    if (!program || !publicKey) {
      toast.error("Connect an admin wallet first");
      return;
    }
    setPauseLoading(true);
    try {
      const configPda = getConfigPda(program.programId);
      const emergencyPda = getEmergencyPausePda(program.programId);
      // Unpause requires verified guardian signers passed as remaining
      // accounts. The connected admin wallet is the (only) guardian today.
      const method = pause
        ? program.methods.emergencyPause()
        : program.methods
            .emergencyUnpause()
            .remainingAccounts([
              { pubkey: publicKey, isSigner: true, isWritable: false },
            ]);
      const builder = method.accounts(
        txAccounts({
          admin: publicKey,
          config: configPda,
          emergencyPause: emergencyPda,
          systemProgram: SystemProgram.programId,
        })
      );
      await sendWithRetry(program, builder);
      setPaused(pause);
      toast.success(
        pause
          ? "Emergency pause activated on-chain"
          : "Program unpaused on-chain"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pause/unpause failed");
    } finally {
      setPauseLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        toast.success(`${key} updated`);
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(null);
    }
  };

  const updateValue = (key: string, newValue: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: newValue } : s))
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-[8px] bg-cream border border-hairline animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-inkblue" />
        <span className="w-1.5 h-5 bg-inkblue rounded-[1px]" />
        <h2 className="text-[21px] font-display font-extrabold text-ink">
          Platform Settings
        </h2>
      </div>

      <div className="rounded-[8px] bg-yellow/15 border border-yellow/30 p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-ink flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-soft">
          Changes take effect immediately. Fee changes apply to new trades only.
        </p>
      </div>

      <div
        className={`rounded-[8px] border p-5 ${
          paused
            ? "bg-magenta/10 border-magenta/30"
            : "bg-cream border-hairline"
        }`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Power
                className={`w-4 h-4 ${paused ? "text-magenta" : "text-ash"}`}
              />
              <label className="text-[13px] font-semibold text-ink block">
                On-Chain Emergency Pause
              </label>
              {paused && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-magenta bg-magenta/10 border border-magenta/30 rounded-[4px] px-1.5 py-0.5">
                  PAUSED
                </span>
              )}
            </div>
            <p className="text-xs text-ash-dim mb-3">
              Halts all non-admin trading on-chain. This is separate from the
              DB-only maintenanceMode flag above.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleEmergencyPause(true)}
              disabled={pauseLoading || paused}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-magenta/10 border border-magenta/30 text-magenta text-xs hover:bg-magenta/20 transition-colors disabled:opacity-50 active:scale-97"
            >
              <Power className="w-3.5 h-3.5" />
              Pause Program
            </button>
            <button
              onClick={() => handleEmergencyPause(false)}
              disabled={pauseLoading || !paused}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-grass/10 border border-grass/30 text-grass text-xs hover:bg-grass/20 transition-colors disabled:opacity-50 active:scale-97"
            >
              <PowerOff className="w-3.5 h-3.5" />
              Unpause
            </button>
          </div>
        </div>
      </div>

      {/* Guardian multisig — who can unpause, and how many signatures are needed */}
      <div className="rounded-[8px] bg-cream border border-hairline p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-grass" />
          <label className="text-[13px] font-semibold text-ink block">
            Unpause Guardians (Multisig)
          </label>
        </div>
        <p className="text-xs text-ash-dim">
          Unpausing requires{" "}
          <span className="text-grass font-mono">{requiredConfirmations}</span>{" "}
          distinct guardian signature(s). The admin is automatically the first
          guardian; add up to 3 total.
        </p>

        {guardians.length > 0 && (
          <div className="space-y-2">
            {guardians.map((g) => (
              <div
                key={g}
                className="flex items-center justify-between gap-3 rounded-[4px] bg-sheet border border-hairline/40 px-3 py-2"
              >
                <span className="font-mono text-[11px] text-ink truncate">
                  {g}
                </span>
                {g !== publicKey?.toBase58() ? (
                  <button
                    onClick={() => handleRemoveGuardian(g)}
                    disabled={guardianLoading}
                    className="flex items-center gap-1 text-[10px] text-magenta hover:text-magenta disabled:opacity-50 flex-shrink-0"
                    title="Remove guardian (lowers threshold first if needed)"
                  >
                    <UserX className="w-3 h-3" />
                    Remove
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-ash flex-shrink-0">
                    (admin)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] uppercase tracking-wider text-ash block mb-1">
              Add Guardian Pubkey
            </label>
            <input
              value={newGuardian}
              onChange={(e) => setNewGuardian(e.target.value)}
              placeholder="Base58 public key…"
              className="w-full bg-sheet border border-hairline rounded-[4px] px-3 py-2 text-[12px] font-mono text-ink focus:outline-none focus:border-cyan"
            />
          </div>
          <button
            onClick={handleAddGuardian}
            disabled={guardianLoading || !newGuardian.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-grass/10 border border-grass/30 text-grass text-xs hover:bg-grass/20 transition-colors disabled:opacity-50 flex-shrink-0 active:scale-97"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="flex items-end gap-2 border-t border-hairline/40 pt-4">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-ash block mb-1">
              Required Confirmations
            </label>
            <input
              type="number"
              min={1}
              max={Math.max(1, guardians.length)}
              value={guardianThreshold}
              onChange={(e) =>
                setGuardianThreshold(Math.max(1, Number(e.target.value)))
              }
              className="w-full bg-sheet border border-hairline rounded-[4px] px-3 py-2 text-[12px] font-mono text-ink focus:outline-none focus:border-cyan"
            />
          </div>
          <button
            onClick={() => handleSetThreshold(guardianThreshold)}
            disabled={
              guardianLoading || guardianThreshold === requiredConfirmations
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-grass/10 border border-grass/30 text-grass text-xs hover:bg-grass/20 transition-colors disabled:opacity-50 flex-shrink-0 active:scale-97"
          >
            <Save className="w-3.5 h-3.5" />
            Set Threshold
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {settings.map((setting, i) => (
          <motion.div
            key={setting.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-[8px] bg-cream border border-hairline p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label className="text-[13px] font-semibold text-ink block mb-1">
                  {setting.label}
                </label>
                {setting.description && (
                  <p className="text-xs text-ash-dim mb-3">
                    {setting.description}
                  </p>
                )}
                {setting.type === "boolean" ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateValue(setting.key, "true")}
                      className={`px-3 py-1.5 text-xs rounded-[4px] border transition-all ${
                        setting.value === "true"
                          ? "bg-grass/20 border-grass/40 text-grass"
                          : "bg-cream border-hairline text-ash"
                      }`}
                    >
                      true
                    </button>
                    <button
                      onClick={() => updateValue(setting.key, "false")}
                      className={`px-3 py-1.5 text-xs rounded-[4px] border transition-all ${
                        setting.value === "false"
                          ? "bg-magenta/20 border-magenta/40 text-magenta"
                          : "bg-cream border-hairline text-ash"
                      }`}
                    >
                      false
                    </button>
                  </div>
                ) : (
                  <input
                    type={setting.type === "number" ? "number" : "text"}
                    value={setting.value}
                    onChange={(e) => updateValue(setting.key, e.target.value)}
                    className="w-full bg-sheet border border-hairline rounded-[4px] px-3 py-2 text-[13px] font-mono text-ink focus:outline-none focus:border-cyan"
                  />
                )}
              </div>
              <button
                onClick={() => saveSetting(setting.key, setting.value)}
                disabled={saving === setting.key}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-ink-fill text-white text-xs hover:bg-ink-fill/90 transition-colors disabled:opacity-50 flex-shrink-0 active:scale-97"
              >
                {saving === setting.key ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
