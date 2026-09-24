export function LoadingSpinner({
  size = "md",
  label,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const sizeClasses = {
    sm: "w-4 h-4 border",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2",
  };
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-12">
      <div
        className={`${sizeClasses[size]} border-[#1E2240] border-t-[#5B8FA8] rounded-full animate-spin`}
      />
      {label && <p className="text-[13px] text-[#4D5180] font-mono">{label}</p>}
    </div>
  );
}
