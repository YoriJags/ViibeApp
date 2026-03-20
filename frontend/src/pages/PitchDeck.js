import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Radio, ArrowRight } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ── Slide data ─────────────────────────── */

const slides = [
  { id: "title" },
  { id: "problem" },
  { id: "breakthrough" },
  { id: "product" },
  { id: "live-data" },
  { id: "business" },
  { id: "market" },
  { id: "moat" },
  { id: "ask" },
];

/* ── Individual Slides ────────────────────── */

function TitleSlide() {
  return (
    <div className="flex flex-col items-start justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-coral uppercase tracking-[0.3em] mb-10">Pre-Seed 2026</p>
      <h1 className="font-display text-7xl md:text-9xl font-bold tracking-tight leading-none mb-4">
        V<span className="text-viibe-cyan">II</span>BE
      </h1>
      <p className="font-display text-2xl md:text-3xl text-neutral-400 font-bold mb-8">Scene Intelligence</p>
      <div className="w-16 h-px bg-viibe-cyan mb-8" />
      <p className="font-mono text-sm text-neutral-500 leading-relaxed max-w-lg">
        Wherever people gather and feel something.<br />
        VIIBE measures it. Live.
      </p>
      <p className="font-mono text-xs text-neutral-700 mt-12">Lagos, Nigeria</p>
    </div>
  );
}

function ProblemSlide() {
  const failures = [
    { name: "Google Maps", issue: "Historical averages. Months old. Built for navigation, not nightlife.", color: "text-viibe-coral" },
    { name: "Social Media", issue: "Curated highlights of a moment that already passed. Always late.", color: "text-viibe-gold" },
    { name: "WhatsApp Groups", issue: "One person's unverified experience. Fragmented. Unreliable.", color: "text-viibe-cyan" },
  ];

  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-coral uppercase tracking-widest mb-6">The problem</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
        Going out is a gamble.
      </h2>
      <p className="font-mono text-lg text-neutral-400 mb-12">
        Nigeria's scene economy is worth <span className="text-white font-bold">$5B+</span>. Not one platform tells you where the energy is right now.
      </p>
      <div className="space-y-6">
        {failures.map((f) => (
          <div key={f.name} className="flex items-start gap-4 border-l-2 border-white/10 pl-6">
            <div>
              <p className={`font-mono text-xs uppercase tracking-wider ${f.color} mb-1`}>{f.name}</p>
              <p className="font-mono text-sm text-neutral-500">{f.issue}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakthroughSlide() {
  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-6">The breakthrough</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">
        We invented the<br /><span className="text-viibe-cyan glow-cyan">tap mechanic.</span>
      </h2>
      <p className="font-mono text-sm text-neutral-400 leading-relaxed max-w-xl mb-12">
        One tap. Geofenced. Time-stamped. Anonymous. That single interaction feeds 16+ algorithms
        that calculate live Vibe Scores, detect energy peaks, predict crowd behavior, and build the only
        real-time scene intelligence dataset on the planet.
      </p>
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "Input", value: "1 tap", color: "text-viibe-cyan" },
          { label: "Algorithms", value: "16+", color: "text-viibe-gold" },
          { label: "Data points", value: "12+", color: "text-viibe-coral" },
          { label: "Latency", value: "< 1s", color: "text-white" },
        ].map((s) => (
          <div key={s.label}>
            <p className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 border-t border-white/5 pt-6">
        <p className="font-mono text-xs text-neutral-600 leading-relaxed">
          Future layers: <span className="text-neutral-400">Drift</span> (passive accelerometer energy) ·{" "}
          <span className="text-neutral-400">Pulse Sync</span> (collective motion detection) ·{" "}
          <span className="text-neutral-400">Pendulum</span> (energy arc capture) ·{" "}
          <span className="text-neutral-400">Echo</span> (historical pattern matching)
        </p>
      </div>
    </div>
  );
}

function ProductSlide() {
  const floors = [
    {
      name: "Scout Floor",
      desc: "Live venue map. 8 Reactor Skins with Skia animations. Geofenced ratings. Vibe Oracle AI predictions. Scene Frequency waveform. Torch Ignite crowd flash.",
      color: "border-viibe-coral",
      tag: "CONSUMER",
    },
    {
      name: "Merchant Floor",
      desc: "Hourly energy curves. Peak detection. Pulse Drop campaigns. Scout intelligence feed. ROI tracking.",
      color: "border-viibe-gold",
      tag: "B2B SAAS",
    },
    {
      name: "Agent API",
      desc: "Public REST API. Live venue scores, city pulse, crowd state. Built for ChatGPT Actions, Claude MCP, Perplexity.",
      color: "border-viibe-cyan",
      tag: "DATA PLATFORM",
    },
  ];

  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-6">The product</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
        Three floors. One terminal.
      </h2>
      <p className="font-mono text-sm text-neutral-500 mb-10">Built solo. Full-stack. Demo-ready.</p>
      <div className="space-y-4">
        {floors.map((f) => (
          <div key={f.name} className={`border-l-2 ${f.color} pl-6 py-3`}>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-display text-lg font-bold">{f.name}</h3>
              <span className="font-mono text-[9px] text-neutral-600 border border-white/10 px-2 py-0.5">{f.tag}</span>
            </div>
            <p className="font-mono text-xs text-neutral-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveDataSlide() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/v1/agent/city/pulse?city=lagos`).then((r) => setData(r.data)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-6">Live demonstration</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
        This is real. Right now.
      </h2>
      <p className="font-mono text-sm text-neutral-500 mb-10">
        Live API response from the VIIBE Agent API. Lagos venue data. Updating every 30 seconds.
      </p>
      <div className="bg-viibe-surface border border-white/5 p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Radio size={10} className="text-viibe-coral animate-glow-pulse" />
          <span className="font-mono text-[10px] text-neutral-500">GET /api/v1/agent/city/pulse?city=lagos</span>
        </div>
        <pre className="font-mono text-xs text-viibe-cyan/80 whitespace-pre-wrap leading-relaxed">
          {data ? JSON.stringify(data, null, 2) : "// fetching live data..."}
        </pre>
      </div>
    </div>
  );
}

function BusinessSlide() {
  const revenue = [
    { tier: "Consumer", model: "Freemium + N2,000/mo premium", timeline: "Month 1", color: "text-viibe-coral" },
    { tier: "Merchant SaaS", model: "N150,000/mo per venue", timeline: "Month 3", color: "text-viibe-gold" },
    { tier: "Agent API", model: "Per-query pricing for AI apps", timeline: "Month 6", color: "text-viibe-cyan" },
    { tier: "Data Licensing", model: "Enterprise + government contracts", timeline: "Year 2", color: "text-white" },
  ];

  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-gold uppercase tracking-widest mb-6">The business</p>
      <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3">
        The app is the acquisition engine.
      </h2>
      <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-viibe-cyan mb-10">
        The terminal is the business.
      </h2>
      <div className="space-y-4">
        {revenue.map((r) => (
          <div key={r.tier} className="flex items-center gap-6 border-b border-white/5 pb-3">
            <span className={`font-display text-sm font-bold w-32 ${r.color}`}>{r.tier}</span>
            <span className="font-mono text-xs text-neutral-400 flex-1">{r.model}</span>
            <span className="font-mono text-[10px] text-neutral-600">{r.timeline}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketSlide() {
  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-gold uppercase tracking-widest mb-6">The market</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-12">
        Lagos first. Africa next.
      </h2>
      <div className="grid grid-cols-3 gap-8 mb-12">
        {[
          { value: "20M+", label: "Lagos population", sub: "Largest city in Africa" },
          { value: "$5B+", label: "Nigeria scene economy", sub: "Nightlife, restaurants, events" },
          { value: "$20B+", label: "Africa by 2030", sub: "Fastest growing consumer market" },
        ].map((s) => (
          <div key={s.label}>
            <p className="font-display text-4xl font-bold text-viibe-cyan glow-cyan">{s.value}</p>
            <p className="font-mono text-xs text-neutral-400 mt-2">{s.label}</p>
            <p className="font-mono text-[10px] text-neutral-600 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="border-l-2 border-viibe-gold pl-6">
        <p className="font-mono text-sm text-neutral-400 leading-relaxed">
          Lagos has one of the most intense nightlife cultures globally. If the infrastructure holds here,
          it's validated for anywhere. Next: <span className="text-white">Accra</span> ·{" "}
          <span className="text-white">Nairobi</span> · <span className="text-white">Johannesburg</span>
        </p>
      </div>
    </div>
  );
}

function MoatSlide() {
  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-6">The moat</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">
        A dataset that<br />doesn't exist yet.
      </h2>
      <p className="font-mono text-sm text-neutral-400 leading-relaxed max-w-xl mb-12">
        Every tap, every night, every venue — the data compounds. No one else is collecting
        time-stamped, geolocated, crowd-verified energy data at this granularity. This dataset
        cannot be replicated retroactively.
      </p>
      <div className="space-y-4">
        {[
          "The more scouts rate, the more accurate scores become. The more accurate scores become, the more scouts join.",
          '"Siri, where\'s the energy in Lagos tonight?" — Every AI assistant needs a data source. VIIBE is the only candidate.',
          "The data compounds every night. The moat deepens every night. By the time competitors notice, we have 12 months of irreplaceable data.",
        ].map((text, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="font-mono text-xs text-viibe-cyan mt-0.5">{String(i + 1).padStart(2, "0")}</span>
            <p className="font-mono text-xs text-neutral-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AskSlide() {
  return (
    <div className="flex flex-col justify-center h-full max-w-4xl mx-auto px-8">
      <p className="font-mono text-xs text-viibe-coral uppercase tracking-widest mb-6">The ask</p>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">
        <span className="text-viibe-gold">$50K – $200K</span><br />Pre-Seed
      </h2>
      <div className="space-y-3 mb-12">
        {[
          { item: "Launch crew + first hire", pct: "40%" },
          { item: "5 anchor venue partnerships", pct: "20%" },
          { item: "500 founding scouts in 90 days", pct: "25%" },
          { item: "Infrastructure + runway", pct: "15%" },
        ].map((u) => (
          <div key={u.item} className="flex items-center gap-4">
            <span className="font-mono text-xs text-viibe-cyan w-10">{u.pct}</span>
            <div className="flex-1 h-px bg-white/10" />
            <span className="font-mono text-xs text-neutral-400">{u.item}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 pt-8">
        <p className="font-mono text-sm text-neutral-500 leading-relaxed mb-4">
          The product is built. The API is live. The tap mechanic works.
        </p>
        <p className="font-display text-xl font-bold text-white">
          Now we need people on the ground in Lagos.
        </p>
      </div>
      <div className="mt-12">
        <p className="font-mono text-xs text-neutral-700">
          Oluwaseun Oluyori Ajagun · CEO & CTO · yoriajagun08@gmail.com · github.com/YoriJags
        </p>
      </div>
    </div>
  );
}

/* ── Deck Shell ───────────────────────────── */

const SLIDE_COMPONENTS = [
  TitleSlide, ProblemSlide, BreakthroughSlide, ProductSlide,
  LiveDataSlide, BusinessSlide, MarketSlide, MoatSlide, AskSlide,
];

export default function PitchDeck() {
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const go = (dir) => setCurrent((c) => Math.max(0, Math.min(total - 1, c + dir)));

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const SlideComponent = SLIDE_COMPONENTS[current];

  return (
    <div className="bg-viibe-base text-white min-h-screen flex flex-col select-none" data-testid="pitch-deck">
      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <div className="h-full" data-testid={`pitch-slide-${current}`}>
          <SlideComponent />
        </div>

        {/* Click zones */}
        <div className="absolute inset-y-0 left-0 w-1/3 cursor-pointer" onClick={() => go(-1)} />
        <div className="absolute inset-y-0 right-0 w-1/3 cursor-pointer" onClick={() => go(1)} />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-8 py-4 border-t border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => go(-1)}
            disabled={current === 0}
            className="text-neutral-600 hover:text-white disabled:opacity-20 transition-colors"
            data-testid="pitch-prev"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-mono text-[10px] text-neutral-500 tabular-nums">
            {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <button
            onClick={() => go(1)}
            disabled={current === total - 1}
            className="text-neutral-600 hover:text-white disabled:opacity-20 transition-colors"
            data-testid="pitch-next"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 transition-all duration-300 ${
                i === current ? "w-6 bg-viibe-cyan" : i < current ? "w-2 bg-viibe-cyan/30" : "w-2 bg-white/10"
              }`}
              data-testid={`pitch-dot-${i}`}
            />
          ))}
        </div>

        <p className="font-mono text-[9px] text-neutral-700">
          V<span className="text-viibe-cyan/50">II</span>BE · Confidential
        </p>
      </div>
    </div>
  );
}
