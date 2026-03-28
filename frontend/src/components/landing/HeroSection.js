import { useState, useEffect } from "react";
import { Activity, TrendingUp, Radio, Zap } from "lucide-react";

const LIVE_VENUES = [
  { name: "Escape",     score: 91, state: "peak",    district: "VI",       delta: +4 },
  { name: "Quilox",     score: 87, state: "electric", district: "VI",       delta: +2 },
  { name: "Club Joker", score: 83, state: "electric", district: "VI",       delta: -1 },
  { name: "Oniru Beach",score: 68, state: "lit",      district: "Oniru",    delta: +6 },
  { name: "Hard Rock",  score: 54, state: "warming",  district: "VI",       delta: +3 },
];

const stateColor = {
  peak:     "text-viibe-coral",
  electric: "text-viibe-cyan",
  lit:      "text-orange-400",
  warming:  "text-viibe-gold",
  chill:    "text-neutral-400",
  quiet:    "text-neutral-600",
};

const stateBg = {
  peak:     "bg-viibe-coral/10",
  electric: "bg-viibe-cyan/10",
  lit:      "bg-orange-400/10",
  warming:  "bg-viibe-gold/10",
  chill:    "bg-neutral-400/10",
  quiet:    "bg-neutral-600/10",
};

function LiveTerminal() {
  const [venues, setVenues] = useState(LIVE_VENUES);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * venues.length);
      setFlash(idx);
      setVenues(prev =>
        prev.map((v, i) => ({
          ...v,
          score: i === idx
            ? Math.max(40, Math.min(99, v.score + Math.floor(Math.random() * 9) - 4))
            : v.score,
        }))
      );
      setTimeout(() => setFlash(null), 600);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="neon-border bg-viibe-base/80 backdrop-blur-xl p-5 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-viibe-coral animate-pulse" />
          <span className="font-mono text-[9px] text-viibe-coral uppercase tracking-widest">Live · Lagos</span>
        </div>
        <span className="font-mono text-[8px] text-neutral-600 uppercase tracking-wider">updating live</span>
      </div>
      <div className="space-y-2">
        {venues.map((v, i) => (
          <div
            key={v.name}
            className={`flex items-center justify-between px-3 py-2 rounded transition-colors duration-500 ${flash === i ? stateBg[v.state] : 'bg-transparent'}`}
          >
            <div>
              <span className="font-mono text-[11px] text-white font-semibold">{v.name}</span>
              <span className="font-mono text-[9px] text-neutral-600 ml-2">{v.district}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[9px] font-bold tabular-nums ${stateColor[v.state]}`}>
                {v.score}
              </span>
              <span className={`font-mono text-[8px] uppercase px-1.5 py-0.5 rounded ${stateColor[v.state]} ${stateBg[v.state]}`}>
                {v.state}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
        <Zap size={9} className="text-viibe-cyan" />
        <span className="font-mono text-[9px] text-neutral-600">Scout Integrity · Energy Decay · Signal Extraction</span>
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
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left — Copy */}
        <div>
          <div className="flex items-center gap-2 mb-8">
            <Activity size={14} className="text-viibe-cyan" />
            <span className="font-mono text-xs text-viibe-cyan uppercase tracking-widest">Scene Intelligence</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-[52px] font-bold tracking-tight leading-[1.08] mb-8">
            AI assistants can tell you anything —
            <span className="text-viibe-cyan glow-cyan"> except what's happening right now,</span>{" "}
            in a physical space, at the human level.
          </h1>

          <div className="border-l-2 border-viibe-coral pl-5 mb-10">
            <p className="font-display text-lg md:text-xl text-white font-bold">
              VIIBE is the data layer that feeds the AI layer.
            </p>
            <p className="font-mono text-sm text-neutral-500 mt-2 leading-relaxed">
              A live sensor network made of people. Real-time crowd energy, venue by venue,
              moment by moment. Starting in Lagos. Scaling across Africa and the Gulf.
            </p>
          </div>

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

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <TrendingUp size={12} className="text-viibe-gold" />
              <span>10 Lagos venues live</span>
            </div>
            <span className="text-neutral-700 hidden sm:block">·</span>
            <span>16+ algorithms</span>
            <span className="text-neutral-700 hidden sm:block">·</span>
            <span>Sensor stack live</span>
            <span className="text-neutral-700 hidden sm:block">·</span>
            <span>Agent API</span>
          </div>
        </div>

        {/* Right — Live terminal */}
        <div className="flex flex-col items-center lg:items-end gap-6">
          <div className="w-full max-w-sm">
            <p className="font-mono text-[9px] text-neutral-600 uppercase tracking-widest mb-2 text-right">
              live venue intelligence feed
            </p>
            <LiveTerminal />
          </div>

          {/* Moment Lock teaser */}
          <div className="w-full max-w-sm neon-border bg-viibe-surface/60 backdrop-blur p-4 border-viibe-cyan/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                <Zap size={14} className="text-purple-400" />
              </div>
              <div>
                <p className="font-mono text-[10px] text-purple-400 uppercase tracking-widest font-bold">⚡ Moment Locked</p>
                <p className="font-mono text-[11px] text-neutral-400 mt-0.5">7 scouts felt it simultaneously at Escape · 00:23</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
