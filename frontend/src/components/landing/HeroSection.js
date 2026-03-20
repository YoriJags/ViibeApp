import { useState, useEffect } from "react";
import { Activity, TrendingUp, Radio } from "lucide-react";
import LagosPulse from "@/components/landing/LagosPulse";

const LIVE_VENUES = [
  { name: "Escape", score: 91, state: "peak", district: "VI" },
  { name: "Quilox", score: 87, state: "electric", district: "VI" },
  { name: "Club Joker", score: 83, state: "electric", district: "VI" },
];

const stateColor = {
  peak: "text-viibe-coral",
  electric: "text-viibe-cyan",
  warming: "text-viibe-gold",
  steady: "text-neutral-400",
};

function LiveTerminal() {
  const [venues, setVenues] = useState(LIVE_VENUES);

  useEffect(() => {
    const interval = setInterval(() => {
      setVenues((prev) =>
        prev.map((v) => ({
          ...v,
          score: Math.max(50, Math.min(99, v.score + Math.floor(Math.random() * 7) - 3)),
        }))
      );
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="neon-border bg-viibe-base/80 backdrop-blur-xl p-4 w-full max-w-sm" data-testid="live-terminal">
      <div className="flex items-center gap-2 mb-3">
        <Radio size={10} className="text-viibe-coral animate-glow-pulse" />
        <span className="font-mono text-[9px] text-viibe-coral uppercase tracking-widest">Feed — Victoria Island</span>
      </div>
      <div className="space-y-1.5">
        {venues.map((v) => (
          <div key={v.name} className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-white">{v.name}</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold tabular-nums ${stateColor[v.state]}`}>{v.score}</span>
              <span className={`text-[8px] uppercase ${stateColor[v.state]}`}>{v.state}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center" data-testid="hero-section">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-viibe-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-viibe-coral/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20 grid lg:grid-cols-2 gap-12 items-center w-full">
        {/* Left — Copy */}
        <div>
          <div className="flex items-center gap-2 mb-8">
            <Activity size={14} className="text-viibe-cyan" />
            <span className="font-mono text-xs text-viibe-cyan uppercase tracking-widest">Scene Intelligence Terminal</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Wherever people gather and feel something.
          </h1>

          <p className="text-xl md:text-2xl text-neutral-400 mb-2 font-display font-bold">
            V<span className="text-viibe-cyan">II</span>BE measures it.{" "}
            <span className="glow-cyan">Live.</span>
          </p>

          <p className="font-mono text-sm text-neutral-500 max-w-md mt-6 mb-10 leading-relaxed">
            Real-time crowd energy data from Lagos. The only live intelligence
            layer for the scene economy — clubs, restaurants, events.
            Starting in Lagos. Scaling across Africa.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#waitlist"
              className="inline-block font-mono text-sm bg-viibe-cyan text-viibe-base px-6 py-3 font-bold hover:bg-viibe-cyan/90 transition-colors"
              data-testid="hero-cta"
            >
              Get Early Access
            </a>
            <a
              href="/docs"
              className="inline-block font-mono text-sm border border-white/10 text-white px-6 py-3 hover:border-viibe-cyan/30 hover:text-viibe-cyan transition-colors"
              data-testid="hero-api-cta"
            >
              Agent API Docs
            </a>
          </div>

          <div className="mt-10 flex items-center gap-6 font-mono text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <TrendingUp size={12} className="text-viibe-gold" />
              <span>10 Lagos venues live</span>
            </div>
            <span className="text-neutral-700">|</span>
            <span>16+ algorithms</span>
            <span className="text-neutral-700">|</span>
            <span>Agent API</span>
          </div>
        </div>

        {/* Right — Lagos Pulse + Live Feed */}
        <div className="flex flex-col items-end gap-4">
          <LagosPulse />
          <LiveTerminal />
        </div>
      </div>
    </section>
  );
}
