import { ChevronLeft, Download, ExternalLink, Mail, Github, Linkedin } from "lucide-react";

const STATS = [
  { label: "Commits", value: "474+", accent: "#00F0FF" },
  { label: "Algorithms", value: "16+", accent: "#FFD700" },
  { label: "Reactor Skins", value: "8", accent: "#FF3366" },
  { label: "Launch City", value: "Lagos", accent: "#00F0FF" },
  { label: "Venues Tracked", value: "10", accent: "#FFD700" },
  { label: "Stage", value: "Pre-Seed", accent: "#FF3366" },
];

const BRAND_COLORS = [
  { name: "Base Black", hex: "#050505" },
  { name: "Electric Cyan", hex: "#00F0FF" },
  { name: "Hot Coral", hex: "#FF3366" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Surface", hex: "#0A0A0A" },
  { name: "Elevated", hex: "#111111" },
];

const PRESS_LINKS = [
  { label: "Pitch Deck", href: "/pitch", desc: "Interactive 9-slide investor presentation" },
  { label: "API Documentation", href: "/docs", desc: "Agent API v1 — real-time venue intelligence" },
  { label: "Weekly Scene Report", href: "/report", desc: "Live Lagos nightlife energy data" },
];

export default function Press() {
  return (
    <div className="bg-viibe-base min-h-screen text-white" data-testid="press-page">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl font-bold tracking-tight" data-testid="press-logo">
            V<span className="text-viibe-cyan">II</span>BE
          </a>
          <a href="/" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors" data-testid="press-back-link">
            <ChevronLeft size={14} /> Back
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-16">
          <span className="font-mono text-xs text-viibe-coral uppercase tracking-widest">Press Kit</span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mt-4 mb-4">
            Brand & Media
          </h1>
          <p className="font-mono text-sm text-neutral-500 max-w-lg leading-relaxed">
            Everything journalists, investors, and partners need to write about VIIBE. 
            Assets, stats, and story — all in one place.
          </p>
        </div>

        {/* One-liner */}
        <div className="border border-white/5 bg-viibe-surface p-8 mb-16" data-testid="press-oneliner">
          <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-3">One-Liner</p>
          <p className="font-display text-xl md:text-2xl font-bold leading-relaxed">
            VIIBE is the first <span className="text-viibe-cyan">scene intelligence</span> platform — 
            measuring real-time crowd energy at nightlife venues, starting in <span className="text-viibe-gold">Lagos</span>.
          </p>
        </div>

        {/* Key Stats */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">Key Numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="press-stats">
            {STATS.map((stat) => (
              <div key={stat.label} className="border border-white/5 bg-viibe-surface p-4">
                <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="font-display text-2xl font-bold" style={{ color: stat.accent }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* About / Founder */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">Founder</h2>
          <div className="border border-white/5 bg-viibe-surface p-6 md:p-8" data-testid="press-founder">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-16 h-16 bg-viibe-cyan/10 border border-viibe-cyan/20 flex items-center justify-center flex-shrink-0">
                <span className="font-display text-xl font-bold text-viibe-cyan">OA</span>
              </div>
              <div>
                <p className="font-display text-lg font-bold mb-1">Oluwaseun Oluyori Ajagun</p>
                <p className="font-mono text-xs text-viibe-cyan mb-3">CEO & CTO — Solo Technical Founder</p>
                <p className="font-mono text-sm text-neutral-400 leading-relaxed mb-4">
                  Solo-built the entire VIIBE stack: 474+ commits, 16 algorithms, 8 Reactor Skins, 
                  Agent API, real-time Socket.IO infrastructure. React Native (Expo 54) + FastAPI + MongoDB. 
                  Previous experience in Lagos nightlife scene; saw firsthand the information gap venues and 
                  night-goers face. Building the infrastructure layer for the scene economy.
                </p>
                <div className="flex gap-4">
                  <a href="mailto:yoriajagun08@gmail.com" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">
                    <Mail size={12} /> Email
                  </a>
                  <a href="https://github.com/YoriJags" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">
                    <Github size={12} /> GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Problem / Story */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">The Story</h2>
          <div className="border border-white/5 bg-viibe-surface p-6 md:p-8 space-y-4" data-testid="press-story">
            <p className="font-mono text-sm text-neutral-300 leading-relaxed">
              <span className="text-viibe-coral font-bold">The Problem:</span> Every Friday night, 2M+ Lagos night-goers make decisions blind. 
              "Is Quilox packed?" "Is Shiro dead tonight?" They rely on stale Instagram stories and WhatsApp hearsay. 
              Venues have zero real-time demand intelligence. A $1.2B nightlife economy operates on vibes — not data.
            </p>
            <p className="font-mono text-sm text-neutral-300 leading-relaxed">
              <span className="text-viibe-cyan font-bold">The Solution:</span> VIIBE turns anonymous scouts at venues into a real-time 
              crowd intelligence network. One tap generates a live energy score (0-99). 16 algorithms weight 
              recency, scout reliability, venue capacity, and time-of-night. The result: a live, city-wide pulse 
              map of where the energy is right now.
            </p>
            <p className="font-mono text-sm text-neutral-300 leading-relaxed">
              <span className="text-viibe-gold font-bold">The Business:</span> Free for scouts. Venues pay $49-199/mo for the Merchant Floor — 
              real-time analytics, surge pricing triggers, competitor benchmarking. The Agent API lets AI assistants 
              answer "where should I go tonight?" with live data. Revenue from venue SaaS + API licensing.
            </p>
          </div>
        </div>

        {/* Brand Colors */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">Brand Colors</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2" data-testid="press-colors">
            {BRAND_COLORS.map((c) => (
              <div key={c.hex} className="text-center">
                <div className="w-full aspect-square border border-white/10 mb-2" style={{ backgroundColor: c.hex }} />
                <p className="font-mono text-[10px] text-neutral-400">{c.name}</p>
                <p className="font-mono text-[9px] text-neutral-600">{c.hex}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">Typography</h2>
          <div className="grid md:grid-cols-2 gap-4" data-testid="press-typography">
            <div className="border border-white/5 bg-viibe-surface p-6">
              <p className="font-display text-2xl font-bold mb-2">Unbounded</p>
              <p className="font-mono text-[10px] text-neutral-500">Headlines & Display — Weights: 400, 700, 900</p>
              <p className="font-display text-sm text-neutral-400 mt-3">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            </div>
            <div className="border border-white/5 bg-viibe-surface p-6">
              <p className="font-mono text-2xl font-bold mb-2">JetBrains Mono</p>
              <p className="font-mono text-[10px] text-neutral-500">Body & Data — Weights: 400, 500, 700</p>
              <p className="font-mono text-sm text-neutral-400 mt-3">0123456789 — ABCdef</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">Quick Links</h2>
          <div className="space-y-3" data-testid="press-links">
            {PRESS_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center justify-between border border-white/5 bg-viibe-surface p-4 hover:border-viibe-cyan/20 transition-colors group"
              >
                <div>
                  <p className="font-mono text-sm text-white group-hover:text-viibe-cyan transition-colors">{link.label}</p>
                  <p className="font-mono text-[10px] text-neutral-500">{link.desc}</p>
                </div>
                <ExternalLink size={14} className="text-neutral-600 group-hover:text-viibe-cyan transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Logo Usage */}
        <div className="mb-16">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-6">Logo</h2>
          <div className="grid md:grid-cols-2 gap-4" data-testid="press-logos">
            <div className="border border-white/5 bg-viibe-base p-12 flex items-center justify-center">
              <p className="font-display text-4xl font-bold tracking-tight">
                V<span className="text-viibe-cyan">II</span>BE
              </p>
            </div>
            <div className="border border-white/5 bg-white p-12 flex items-center justify-center">
              <p className="font-display text-4xl font-bold tracking-tight text-black">
                V<span style={{ color: "#00F0FF" }}>II</span>BE
              </p>
            </div>
          </div>
          <p className="font-mono text-[10px] text-neutral-600 mt-3">
            Dark background preferred. "II" always in Electric Cyan (#00F0FF). No rounded logo treatments.
          </p>
        </div>

        {/* Contact */}
        <div className="border-t border-white/5 pt-8">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">Media Contact</h2>
          <div className="flex flex-wrap gap-6">
            <a href="mailto:yoriajagun08@gmail.com" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">
              <Mail size={12} /> yoriajagun08@gmail.com
            </a>
            <a href="https://github.com/YoriJags" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">
              <Github size={12} /> github.com/YoriJags
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
