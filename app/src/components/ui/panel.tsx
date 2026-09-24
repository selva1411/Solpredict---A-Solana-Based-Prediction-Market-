import { cn } from "@/lib/utils";

export function Panel({
  children,
  feature = false,
  className = "",
}: {
  children: React.ReactNode;
  feature?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bg-cream border border-hairline rounded-xl overflow-hidden shadow-sm", className)}>
      {feature && <div className="h-0.5 bg-primary" aria-hidden />}
      {children}
    </div>
  );
}
