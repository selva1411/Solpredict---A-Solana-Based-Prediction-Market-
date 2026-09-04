"use client";
import { LabelLux } from "./label-lux";

export function Outcome({
  side,
  price,
  selected,
  onSelect,
}: {
  side: "YES" | "NO";
  price: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const tone = side === "YES" ? "text-ink" : "text-ink";
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-end justify-between rounded-[8px] border-2 px-5 py-4 text-left transition-colors duration-150 snap
        ${
          side === "YES"
            ? selected
              ? "bg-yes-fill text-ink border-ink"
              : "bg-cream border-hairline hover:border-yes"
            : selected
            ? "bg-no-fill text-white border-ink"
            : "bg-cream border-hairline hover:border-no"
        }`}
    >
      <div>
        <LabelLux>{side}</LabelLux>
        <div className={`num mt-2 text-[28px] ${tone}`}>{price}</div>
      </div>
      <div className="label-lux pb-1">{selected ? "SELECTED" : "SELECT"}</div>
    </button>
  );
}
