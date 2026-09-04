export default function RootLoading() {
  return (
    <div className="min-h-screen bg-ground flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-[4px] animate-spin" />
        <p className="text-[13px] text-ash font-mono">Loading SOLPredict...</p>
      </div>
    </div>
  );
}
