import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC_ARTICLES, getDocArticle } from "@/lib/docs";

const ICON_GLYPH: Record<string, string> = {
  terminal: ">_",
  activity: "≈",
  candlestick: "⌁",
  coins: "◎",
  radar: "⌖",
  shield: "◆",
  settings: "S",
};

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug === "help" || slug === "index") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="surface rounded-[8px] p-8 border-t-4 border-t-cyan">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash mb-3">
            <span className="w-1.5 h-5 bg-cyan rounded-[1px] inline-block" />{" "}
            SOLPREDICT // HELP DESK
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Documentation & Help
          </h1>
          <p className="mt-3 text-[13px] text-ash leading-relaxed max-w-2xl">
            Guides for getting started, trading, claiming payouts, understanding
            the Pyth oracle, and the protocol&apos;s security safeguards.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {DOC_ARTICLES.map((article, i) => {
            const accents = [
              "border-t-cyan",
              "border-t-magenta",
              "border-t-yellow",
              "border-t-grass",
              "border-t-inkblue",
            ];
            const badgeColors = [
              "bg-cyan/10 border-cyan/30 text-cyan",
              "bg-magenta/10 border-magenta/30 text-magenta",
              "bg-yellow/10 border-yellow/30 text-ink",
              "bg-grass/10 border-grass/30 text-grass",
              "bg-inkblue/10 border-inkblue/30 text-inkblue",
            ];
            return (
              <Link
                key={article.slug}
                href={`/docs/${article.slug}`}
                className="surface rounded-[8px] p-6 group transition-colors hover:border-ink/20 border-t-4"
                style={{ borderTopColor: undefined }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-8 h-8 flex items-center justify-center border font-mono text-[13px] rounded-[4px] ${
                      badgeColors[i % badgeColors.length]
                    }`}
                  >
                    {ICON_GLYPH[article.icon] ?? "▸"}
                  </div>
                  <h2 className="font-display text-[21px] font-semibold text-ink group-hover:text-inkblue transition-colors">
                    {article.title}
                  </h2>
                </div>
                <p className="text-xs text-ash leading-relaxed">
                  {article.summary}
                </p>
                <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-cyan">
                  Open guide →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const article = getDocArticle(slug);
  if (!article) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      <Link
        href="/docs/help"
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ash hover:text-inkblue"
      >
        ← All guides
      </Link>

      <div className="surface rounded-[8px] p-8 border-t-4 border-t-magenta">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash mb-3">
          <span className="w-1.5 h-5 bg-magenta rounded-[1px] inline-block" />{" "}
          SOLPREDICT // GUIDE
        </div>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-cyan/10 border border-cyan/30 text-cyan font-mono rounded-[4px]">
            {ICON_GLYPH[article.icon] ?? "▸"}
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              {article.title}
            </h1>
            <p className="mt-2 text-[13px] text-ash">{article.summary}</p>
          </div>
        </div>
      </div>

      {article.sections.map((section, i) => {
        return (
          <section key={section.heading} className="surface rounded-[8px] p-6">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="w-1.5 h-5 rounded-[1px] inline-block flex-shrink-0"
                style={{
                  backgroundColor:
                    i === 0
                      ? "var(--color-cyan)"
                      : i === 1
                      ? "var(--color-magenta)"
                      : i === 2
                      ? "var(--color-yellow)"
                      : i % 2 === 0
                      ? "var(--color-grass)"
                      : "var(--color-cyan)",
                }}
              />
              <h2 className="font-display text-[21px] font-semibold text-ink">
                {section.heading}
              </h2>
            </div>
            <p className="text-[13px] text-ink-soft leading-relaxed pl-4">
              {section.body}
            </p>
          </section>
        );
      })}
    </div>
  );
}
