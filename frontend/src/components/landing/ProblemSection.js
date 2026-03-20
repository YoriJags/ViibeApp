import { MapPin, Camera, MessageCircle } from "lucide-react";

const problems = [
  {
    icon: MapPin,
    label: "Google Maps",
    headline: "Historical averages. Months old.",
    body: "Built for navigation, not nightlife energy. 'Popular Times' shows you where the crowd WAS last Tuesday — not where the energy IS tonight.",
    color: "text-viibe-coral",
  },
  {
    icon: Camera,
    label: "Social Media",
    headline: "Curated. Not live. Always late.",
    body: "A highlight reel of a moment that has already passed. By the time it's on Instagram, the DJ already left and the vibe shifted.",
    color: "text-viibe-gold",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp Groups",
    headline: "Fragmented. Unreliable. Too late.",
    body: "One person's experience, unverified, unscaled. Your friend says 'it's lit' — but they've been drinking since 9pm. You need data, not vibes.",
    color: "text-viibe-cyan",
  },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="py-24 md:py-32" data-testid="problem-section">
      <div className="max-w-7xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-coral uppercase tracking-widest mb-4">The problem</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Going out is a gamble.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-xl mb-16">
          Nigeria's scene economy is worth $5B+. Not one platform tells you where the energy is right now.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div key={p.label} className="neon-border bg-viibe-surface p-8 group" data-testid={`problem-card-${p.label.toLowerCase().replace(' ', '-')}`}>
              <p.icon size={20} className={`${p.color} mb-5`} />
              <p className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-3">{p.label}</p>
              <h3 className="font-display text-lg font-bold mb-3">{p.headline}</h3>
              <p className="font-mono text-xs text-neutral-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
