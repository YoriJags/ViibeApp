import { Gauge, BarChart3, Code2, Flame, Radio, Eye, Zap, Play } from "lucide-react";

const features = [
  {
    title: "Scout Floor",
    subtitle: "Find the scene. Rate the vibe. Earn clout.",
    description: "Live venue map with Vibe Scores. 8 Reactor Skins with Skia animations. Geofenced ratings. Torch Ignite crowd flash. Oracle AI predictions. Scene Frequency waveform.",
    icon: Flame,
    color: "viibe-coral",
    span: "md:col-span-7 md:row-span-2",
    items: ["VibeReactor", "Oracle AI", "Scene Frequency", "Torch Ignite"],
    hasReactor: true,
  },
  {
    title: "Merchant Floor",
    subtitle: "Live analytics for venue operators.",
    description: "Hourly energy curves. Peak detection. Pulse Drop campaigns. Scout intelligence feed. Direction tracking.",
    icon: BarChart3,
    color: "viibe-gold",
    span: "md:col-span-5",
    items: ["Energy Curves", "Pulse Drops", "ROI Metrics"],
  },
  {
    title: "Agent API",
    subtitle: "Real-time data for AI agents.",
    description: "Public REST API returning live venue energy scores, city pulse summaries, and crowd state. Built for ChatGPT Actions, Claude MCP, Perplexity.",
    icon: Code2,
    color: "viibe-cyan",
    span: "md:col-span-5",
    items: ["REST API", "AI-Ready", "Live Data"],
  },
];

const stats = [
  { label: "Algorithms", value: "16+", icon: Gauge },
  { label: "Reactor Skins", value: "4", icon: Eye },
  { label: "AI Pipelines", value: "3", icon: Zap },
  { label: "Lagos Venues", value: "10+", icon: Radio },
];

function FeatureCard({ feature, onOpenReactor }) {
  const borderHover = {
    "viibe-coral": "hover:border-viibe-coral/30",
    "viibe-gold": "hover:border-viibe-gold/30",
    "viibe-cyan": "hover:border-viibe-cyan/30",
  };
  const textColor = {
    "viibe-coral": "text-viibe-coral",
    "viibe-gold": "text-viibe-gold",
    "viibe-cyan": "text-viibe-cyan",
  };

  return (
    <div
      className={`${feature.span} neon-border bg-viibe-surface p-8 group transition-all duration-300 ${borderHover[feature.color]}`}
      data-testid={`feature-${feature.title.toLowerCase().replace(' ', '-')}`}
    >
      <feature.icon size={22} className={`${textColor[feature.color]} mb-5`} />
      <p className={`font-mono text-[10px] uppercase tracking-widest ${textColor[feature.color]} mb-2`}>{feature.subtitle}</p>
      <h3 className="font-display text-xl font-bold mb-3">{feature.title}</h3>
      <p className="font-mono text-xs text-neutral-400 leading-relaxed mb-6">{feature.description}</p>

      <div className="flex flex-wrap items-center gap-2">
        {feature.items.map((item) => (
          <span key={item} className="font-mono text-[10px] px-2 py-1 border border-white/10 text-neutral-400">
            {item}
          </span>
        ))}
        {feature.hasReactor && onOpenReactor && (
          <button
            onClick={onOpenReactor}
            className="font-mono text-[10px] px-3 py-1 border border-viibe-coral/40 text-viibe-coral hover:bg-viibe-coral/10 transition-colors flex items-center gap-1.5 ml-1"
            data-testid="demo-reactor-btn"
          >
            <Play size={10} /> Demo Reactor
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProductShowcase({ onOpenReactor }) {
  return (
    <section id="product" className="py-24 md:py-32" data-testid="product-section">
      <div className="max-w-7xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-4">The product</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Built. Live. Demo-ready.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-xl mb-12">
          Three floors. One intelligence layer. Built solo from concept to production.
        </p>

        <div className="grid md:grid-cols-12 gap-6 mb-16">
          {features.map((f) => (
            <FeatureCard key={f.title} feature={f} onOpenReactor={onOpenReactor} />
          ))}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="neon-border bg-viibe-surface p-5 text-center" data-testid={`stat-${s.label.toLowerCase()}`}>
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
