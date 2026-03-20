import { useState, useEffect } from "react";
import { Radio } from "lucide-react";

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
    <div className="neon-border bg-viibe-base/80 backdrop-blur-xl p-5 w-full max-w-md" data-testid="live-terminal">
      <div className="flex items-center gap-2 mb-4">
        <Radio size={10} className="text-viibe-coral animate-glow-pulse" />
        <span className="font-mono text-[9px] text-viibe-coral uppercase tracking-widest">Feed — Victoria Island</span>
      </div>
      <div className="space-y-2">
        {venues.map((v) => (
          <div key={v.name} className="flex items-center justify-between font-mono text-xs">
            <span className="text-white">{v.name}</span>
            <div className="flex items-center gap-3">
              <span className={`font-bold tabular-nums ${stateColor[v.state]}`}>{v.score}</span>
              <span className={`text-[9px] uppercase tracking-wider ${stateColor[v.state]}`}>{v.state}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div className="neon-border bg-viibe-surface px-6 py-4 text-center">
      <p className="font-display text-xl font-bold glow-cyan">{value}</p>
      <p className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider mt-1">{label}</p>
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

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left — Copy */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="w-6 h-[2px] bg-viibe-coral" />
            <span className="font-mono text-xs text-viibe-coral uppercase tracking-widest">Scene Intelligence · Lagos</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            The city{" "}
            <br className="hidden md:block" />
            has a{" "}
            <br className="hidden md:block" />
            <span className="glow-cyan">pulse.</span>
          </h1>

          <p className="font-mono text-sm text-neutral-400 max-w-md mt-6 mb-10 leading-relaxed">
            Real-time venue energy, live from the streets. VIIBE crowdsources
            the live vibe of every club, bar and event — updated every second,
            by scouts physically inside.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 font-mono text-sm bg-viibe-cyan text-viibe-base px-6 py-3 font-bold hover:bg-viibe-cyan/90 transition-colors"
              data-testid="hero-cta"
            >
              <span className="w-2 h-2 bg-viibe-base rounded-full" />
              Join the waitlist
            </a>
            <a
              href="#product"
              className="inline-flex items-center gap-2 font-mono text-sm text-neutral-400 hover:text-white transition-colors"
              data-testid="hero-product-cta"
            >
              See the product <span className="ml-1">&rarr;</span>
            </a>
          </div>
        </div>

        {/* Right — Live Feed + Stats */}
        <div className="flex flex-col items-end gap-4">
          <LiveTerminal />
          <div className="grid grid-cols-3 gap-3 w-full max-w-md">
            <StatBox value="16+" label="Algorithms" />
            <StatBox value="<1s" label="Latency" />
            <StatBox value="Live" label="Right now" />
          </div>
        </div>
      </div>
    </section>
  );
}
