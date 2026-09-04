import { cn } from "@/lib/utils";

type V = "ink" | "ghost" | "quiet";
export function ButtonLux({
  variant = "ink",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V }) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[4px] px-6 font-bold text-[13px] snap " +
    "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-cream focus-visible:outline-none active:translate-y-px disabled:opacity-40 " +
    "disabled:pointer-events-none";
  const v: Record<V, string> = {
    ink: "bg-ink-fill text-white hover:bg-ink-fill-soft",
    ghost:
      "border-2 border-ink bg-cream text-ink hover:bg-yellow hover:text-ink-static",
    quiet: "text-ash hover:text-ink",
  };
  return <button className={cn(base, v[variant], className)} {...p} />;
}
