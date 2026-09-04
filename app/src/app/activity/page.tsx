"use client";
import ActivityFeed from "@/components/ActivityFeed";
import { LabelLux } from "@/components/ui/label-lux";
import { Activity } from "lucide-react";

export default function ActivityPage() {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-magenta" aria-hidden />
          <LabelLux className="!text-magenta">Activity</LabelLux>
        </div>
        <h1 className="font-display text-[34px] font-extrabold text-ink tracking-tight">
          The Tape
        </h1>
        <p className="text-[13px] text-ash mt-2">
          Recent transactions across all markets
        </p>
      </div>
      <div className="bg-cream border border-hairline rounded-[8px] shadow-sm p-5">
        <ActivityFeed limit={50} />
      </div>
    </main>
  );
}
