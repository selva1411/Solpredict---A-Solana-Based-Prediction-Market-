import { cn } from "@/lib/utils";

type V = "ink" | "ghost" | "quiet";
export function ButtonLux({
  variant = "ink",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V }) {
  const base =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[3px] px-4 font-medium text-[13px] " +
    "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1F3A52] dark:focus-visible:ring-[#7A9BB5] " +
    "disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
  const v: Record<V, string> = {
    ink: "bg-[#1F3A52] text-white hover:bg-[#162B3D] dark:bg-[#6D97B0] dark:text-[#131518] dark:hover:bg-[#7FA7BF]",
    ghost:
      "border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A]",
    quiet: "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]",
  };
  return <button className={cn(base, v[variant], className)} {...p} />;
}
