import { Gauge, BarChart3, Code2, Flame, Radio, Eye, Zap, Brain } from "lucide-react";

const features = [
  {
    title: "Scout Floor",
    subtitle: "Feel it. Fire it. Lock it.",
    description: "Live venue map with Vibe Scores. Three-gesture Moment mechanic — shake, raise to face, back tap. When 5+ scouts fire within 8 seconds: Moment Lock. Memory Artifact generates a shareable energy arc for IG Stories + Snapchat. Geofenced ratings. Scout Integrity Score weights every signal. Energy decay keeps data honest.",
    icon: Flame,
    color: "viibe-coral",
    span: "md:col-span-7 md:row-span-2",
    items: ["Moment Lock", "3-Gesture Sensor Stack", "Memory Artifact", "Scout Integrity AI", "IG + Snap Share"],
    hasReactor: false,
  },
  {
    title: "Merchant Floor",
    subtitle: "Live analytics for venue operators.",
    description: "Hourly energy curves. Peak detection. Comparative framing — 'Hotter than last Saturday at this time'. Pulse Drop campaigns. Aura Shield alerts. Scout intelligence feed.",
    icon: BarChart3,
    color: "viibe-gold",
    span: "md:col-span-5",
    items: ["Energy Curves", "Comparative AI", "Pulse Drops", "Aura Shield"],
  },
  {
    title: "Agent API",
    subtitle: "The ground truth layer for AI.",
    description: "Public REST API returning live venue energy scores, city pulse, crowd state, and Moment Lock events. Queryable by ChatGPT Actions, Claude MCP, Perplexity, and any AI assistant that needs real-world, real-time data.",
    icon: Code2,
    color: "viibe-cyan",
    span: "md:col-span-5",
    items: ["ChatGPT Actions", "Claude MCP", "Perplexity", "Live Data"],
  },
];

const stats = [
  { label: "Algorithms",      value: "16+", icon: Gauge },
  { label: "AI Layers",       value: "5",   icon: Brain },
  { label: "Gesture Inputs",  value: "3",   icon: Zap },
  { label: "Lagos Venues",    value: "10",  icon: Radio },
];

const colorMap = {
  "viibe-coral": { text: "text-viibe-coral", border: "hover:border-viibe-coral/30", tag: "border-viibe-coral/20 text-viibe-coral/70" },
  "viibe-gold":  { text: "text-viibe-gold",  border: "hover:border-viibe-gold/30",  tag: "border-viibe-gold/20 text-viibe-gold/70" },
  "viibe-cyan":  { text: "text-viibe-cyan",  border: "hover:border-viibe-cyan/30",  tag: "border-viibe-cyan/20 text-viibe-cyan/70" },
};

function FeatureCard({ feature }) {
  const c = colorMap[feature.color];
  return (
    <div className={`${feature.span} neon-border bg-viibe-surface p-8 group transition-all duration-300 ${c.border}`}>
      <feature.icon size={22} className={`${c.text} mb-5`} />
      <p className={`font-mono text-[10px] uppercase tracking-widest ${c.text} mb-2`}>{feature.subtitle}</p>
      <h3 className="font-display text-xl font-bold mb-3">{feature.title}</h3>
      <p className="font-mono text-xs text-neutral-400 leading-relaxed mb-6">{feature.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        {feature.items.map(item => (
          <span key={item} className={`font-mono text-[10px] px-2 py-1 border ${c.tag}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProductShowcase() {
  return (
    <section id="product" className="py-24 md:py-32" data-testid="product-section">
      <div className="max-w-7xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-4">The product</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-2">
          Built. Live. Demo-ready.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-xl mb-12">
          Three floors. One intelligence layer. Every human signal is AI-enriched, weighted, and decayed on a live clock.
        </p>

        <div className="grid md:grid-cols-12 gap-6 mb-16">
          {features.map(f => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="neon-border bg-viibe-surface p-5 text-center">
              <s.icon size={16} className="text-viibe-cyan mx-auto mb-2" />
              <p className="font-display text-2xl font-bold glow-cyan">{s.value}</p>
              <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
