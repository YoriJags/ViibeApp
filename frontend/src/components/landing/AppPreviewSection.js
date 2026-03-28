/**
 * AppPreviewSection
 *
 * Interactive CSS mockups of the four key VIIBE screens:
 *   1. Venue List — live scores, decay chip, comparative framing
 *   2. VibeReactor — pulsing orb, score, gesture icons
 *   3. Moment Lock — overlay with shockwave rings + scout count
 *   4. Memory Artifact — energy arc card + share buttons
 *
 * No images. Everything rendered in CSS + animation.
 * Tabs let the visitor switch between screens.
 */
import { useState, useEffect, useRef } from "react";
import { Zap, Flame, BarChart3, Share2 } from "lucide-react";

// ─── Shared ───────────────────────────────────────────────────────────────────

function PhoneFrame({ children, accent = "#6655FF" }) {
  return (
    <div className="relative mx-auto" style={{ width: 260, height: 520 }}>
      {/* Phone shell */}
      <div
        className="absolute inset-0 rounded-[40px] border-2"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "#06060F" }}
      />
      {/* Notch */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: 80, height: 10, background: "#0A0A18" }}
      />
      {/* Screen area */}
      <div
        className="absolute inset-x-0 overflow-hidden"
        style={{ top: 20, bottom: 16, borderRadius: "32px" }}
      >
        {children}
      </div>
      {/* Glow under phone */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-full blur-2xl opacity-40"
        style={{ width: 160, height: 40, background: accent }}
      />
    </div>
  );
}

// ─── Screen 1: Venue List ─────────────────────────────────────────────────────

const VENUES = [
  { name: "Escape",      score: 91, state: "PEAK",    color: "#FF3366", mins: 3 },
  { name: "Quilox",      score: 87, state: "ELECTRIC", color: "#00F0FF", mins: 7 },
  { name: "Club Joker",  score: 72, state: "LIT",      color: "#FF8C00", mins: 22 },
  { name: "Hard Rock",   score: 54, state: "WARMING",  color: "#C9A84C", mins: 67 },
];

function VenueListScreen() {
  const [venues, setVenues] = useState(VENUES);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const id = setInterval(() => {
      const i = Math.floor(Math.random() * 3);
      setFlash(i);
      setVenues(p => p.map((v, idx) => idx === i
        ? { ...v, score: Math.max(50, Math.min(99, v.score + Math.floor(Math.random() * 7) - 3)) }
        : v
      ));
      setTimeout(() => setFlash(null), 500);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "#06060F", height: "100%", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 900, color: "#FF3366", letterSpacing: 3 }}>VIIBE</span>
        <span style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>LAGOS · LIVE</span>
      </div>

      {venues.map((v, i) => {
        const isStale = v.mins >= 45;
        const opacity = isStale ? 0.45 : 1;
        return (
          <div
            key={v.name}
            style={{
              background: flash === i ? v.color + "12" : "rgba(255,255,255,0.03)",
              border: `1px solid ${flash === i ? v.color + "44" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 12,
              padding: "10px 12px",
              transition: "all 0.4s",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#FFF", marginBottom: 3 }}>{v.name}</div>
              {isStale ? (
                <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 3 }}>
                  <span>⏱</span><span>{v.mins}m ago</span>
                </div>
              ) : (
                <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
                  Hotter than last Friday
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", opacity }}>
              <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: isStale ? "rgba(255,255,255,0.25)" : v.color }}>
                {v.score}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 7, color: isStale ? "rgba(255,255,255,0.2)" : v.color, letterSpacing: 1 }}>
                {isStale ? "STALE" : v.state}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: "auto", fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.15)", textAlign: "center", letterSpacing: 1 }}>
        ENERGY DECAY ACTIVE · SCOUT INTEGRITY WEIGHTED
      </div>
    </div>
  );
}

// ─── Screen 2: VibeReactor ────────────────────────────────────────────────────

function ReactorScreen() {
  const [score, setScore] = useState(87);
  const [ring, setRing] = useState(0.72);
  const [pulse, setPulse] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setScore(s => Math.max(60, Math.min(99, s + Math.floor(Math.random() * 5) - 2)));
      setPulse(p => p === 1 ? 1.06 : 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRing(r => r === 0.72 ? 0.82 : 0.72);
    }, 900);
    return () => clearInterval(id);
  }, []);

  const color = score >= 85 ? "#FF3366" : score >= 65 ? "#FF8C00" : "#6655FF";
  const label = score >= 85 ? "PEAK" : score >= 65 ? "LIT" : "WARMING";

  return (
    <div style={{ background: "#06060F", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, gap: 16 }}>
      {/* Venue name */}
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textAlign: "center" }}>
        ESCAPE · VICTORIA ISLAND
      </div>

      {/* Orb */}
      <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Outer ring */}
        <div style={{
          position: "absolute", width: 160 * ring, height: 160 * ring,
          borderRadius: "50%", border: `1px solid ${color}33`,
          transition: "all 0.9s ease-in-out",
        }} />
        {/* Middle ring */}
        <div style={{
          position: "absolute", width: 120, height: 120,
          borderRadius: "50%", border: `1.5px solid ${color}55`,
        }} />
        {/* Core orb */}
        <div style={{
          width: 90, height: 90, borderRadius: "50%",
          background: `radial-gradient(circle at 40% 35%, ${color}CC, ${color}44)`,
          boxShadow: `0 0 40px ${color}66, 0 0 80px ${color}22`,
          transform: `scale(${pulse})`,
          transition: "transform 0.9s ease-in-out, background 0.5s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, color: "#FFF" }}>{score}</span>
        </div>
      </div>

      {/* Label */}
      <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 900, color, letterSpacing: 4 }}>{label}</div>

      {/* Gesture icons */}
      <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
        {[
          { icon: "📳", label: "SHAKE" },
          { icon: "👆", label: "RAISE" },
          { icon: "⬛", label: "TAP" },
        ].map(g => (
          <div key={g.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{g.icon}</div>
            <div style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>{g.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: 1, textAlign: "center" }}>
        TAP · SHAKE · RAISE TO FACE · BACK TAP
      </div>
    </div>
  );
}

// ─── Screen 3: Moment Lock ────────────────────────────────────────────────────

function MomentLockScreen() {
  const [count, setCount] = useState(1);
  const [rings, setRings] = useState([]);
  const target = 7;

  useEffect(() => {
    // Count up
    let c = 1;
    const id = setInterval(() => {
      c = Math.min(c + 1, target);
      setCount(c);
      if (c >= target) clearInterval(id);
    }, 80);

    // Spawn shockwave rings
    const spawn = () => setRings(r => [...r.slice(-3), { id: Date.now(), born: Date.now() }]);
    spawn();
    const sid = setInterval(spawn, 900);

    return () => { clearInterval(id); clearInterval(sid); };
  }, []);

  // Prune old rings
  useEffect(() => {
    const id = setInterval(() => {
      setRings(r => r.filter(ring => Date.now() - ring.born < 1800));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const ACCENT = "#6655FF";

  return (
    <div style={{ background: "#06060F", height: "100%", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* Color wash */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${ACCENT}44 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Shockwave rings */}
      {rings.map(ring => {
        const age = (Date.now() - ring.born) / 1800;
        const r   = 20 + age * 200;
        const op  = Math.max(0, 0.6 - age * 0.6);
        return (
          <div key={ring.id} style={{
            position: "absolute",
            width: r * 2, height: r * 2,
            borderRadius: "50%",
            border: `1.5px solid ${ACCENT}`,
            opacity: op,
            top: "38%", left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            transition: "none",
          }} />
        );
      })}

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 2,
        background: "rgba(10,10,28,0.85)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${ACCENT}55`,
        borderRadius: 24,
        padding: "24px 28px",
        textAlign: "center",
        width: 210,
      }}>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 5, marginBottom: 8 }}>MOMENT</div>
        <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 900, color: "#FFF", letterSpacing: 4, lineHeight: 1.1 }}>LOCKED</div>
        <div style={{ width: 40, height: 1, background: `${ACCENT}88`, margin: "14px auto" }} />
        <div style={{ fontFamily: "monospace", fontSize: 52, fontWeight: 900, color: "#FFF", lineHeight: 1 }}>{count}</div>
        <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: 3, marginTop: 6 }}>SCOUTS FELT THIS</div>
        <div style={{ marginTop: 14, fontFamily: "monospace", fontSize: 9, color: ACCENT, letterSpacing: 1, border: `1px solid ${ACCENT}44`, borderRadius: 12, padding: "4px 12px", display: "inline-block" }}>
          ESCAPE · VI
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 16, fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.15)", letterSpacing: 1 }}>
        TAP ANYWHERE TO CLOSE
      </div>
    </div>
  );
}

// ─── Screen 4: Memory Artifact ────────────────────────────────────────────────

function MemoryScreen() {
  const ACCENT   = "#6655FF";
  const LOCK_C   = "#FF3366";
  // Simulated energy arc points
  const arcPoints = [5,8,12,9,15,22,18,30,42,38,55,72,68,80,75,88,91,85,78,60,50,45,55,62,48];

  const W = 186, H = 56;
  const min = Math.min(...arcPoints);
  const max = Math.max(...arcPoints);
  const norm = v => H - ((v - min) / (max - min)) * (H - 8) - 4;
  const xOf  = i => (i / (arcPoints.length - 1)) * W;

  const polyline = arcPoints.map((v, i) => `${xOf(i)},${norm(v)}`).join(" ");
  const fillPoly = `0,${H} ${polyline} ${W},${H}`;

  // Lock positions (indices where locks happened)
  const lockIdxs = [10, 16, 22];

  return (
    <div style={{ background: "#06060F", height: "100%", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 900, color: "#FF3366", letterSpacing: 3 }}>VIIBE</span>
          <span style={{ fontFamily: "monospace", fontSize: 7, color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 4, padding: "1px 5px", letterSpacing: 1 }}>MEMORY</span>
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.2)" }}>LAGOS · SAT 28</span>
      </div>

      <div style={{ height: 1, background: `${ACCENT}22` }} />

      {/* Venue */}
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 2 }}>YOU WERE AT</div>
        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 900, color: "#FFF" }}>Escape</div>
        <div style={{ fontFamily: "monospace", fontSize: 8, color: ACCENT, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <span>⚡</span><span>PEAK VIBE 91</span>
        </div>
      </div>

      {/* Energy arc */}
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: 2, marginBottom: 4 }}>ENERGY ARC</div>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="arcFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.2" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={fillPoly} fill="url(#arcFill)" />
          <polyline points={polyline} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Lock lines */}
          {lockIdxs.map(idx => (
            <g key={idx}>
              <line x1={xOf(idx)} y1={0} x2={xOf(idx)} y2={H} stroke={LOCK_C} strokeWidth="1" opacity="0.6" />
              <circle cx={xOf(idx)} cy={norm(arcPoints[idx])} r="3" fill={LOCK_C} />
            </g>
          ))}
        </svg>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { label: "SIGNALS", val: 24, color: ACCENT },
          { label: "LOCKS",   val: 3,  color: LOCK_C },
          { label: "SCOUTS",  val: 11, color: "#C9A84C" },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, padding: "8px 4px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontFamily: "monospace", fontSize: 6, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Share buttons */}
      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <div style={{ flex: 1, background: `linear-gradient(90deg, ${ACCENT}, #8844FF)`, borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 900, color: "#FFF", letterSpacing: 1 }}>SHARE MEMORY</span>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #833AB4, #FD1D1D)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14 }}>📸</span>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FFFC00", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14 }}>👻</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "venues",  label: "Venue Feed",    icon: Flame,    accent: "#FF3366", screen: VenueListScreen },
  { id: "reactor", label: "Reactor",       icon: Zap,      accent: "#6655FF", screen: ReactorScreen },
  { id: "moment",  label: "Moment Lock",   icon: BarChart3, accent: "#6655FF", screen: MomentLockScreen },
  { id: "memory",  label: "Memory",        icon: Share2,   accent: "#6655FF", screen: MemoryScreen },
];

// ─── Section ──────────────────────────────────────────────────────────────────

export default function AppPreviewSection() {
  const [active, setActive] = useState("venues");
  const tab = TABS.find(t => t.id === active);
  const Screen = tab.screen;

  return (
    <section id="preview" className="py-24 md:py-32 relative" data-testid="app-preview-section">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-4">See it live</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3">
          This is what scouts see.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-xl mb-10">
          Every screen runs on real data. The mockups below mirror the actual app — animated, live, no placeholders.
        </p>

        {/* Tab selector */}
        <div className="flex flex-wrap gap-2 mb-12">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-2 font-mono text-xs px-4 py-2 border transition-all duration-200 ${
                active === t.id
                  ? "border-white/20 text-white bg-white/5"
                  : "border-white/5 text-neutral-500 hover:border-white/10 hover:text-neutral-300"
              }`}
            >
              <t.icon size={12} style={{ color: active === t.id ? t.accent : undefined }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Phone + description */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Phone */}
          <div className="flex justify-center lg:justify-start">
            <PhoneFrame accent={tab.accent}>
              <Screen key={active} />
            </PhoneFrame>
          </div>

          {/* Description */}
          <div>
            {active === "venues" && (
              <div className="space-y-6">
                <h3 className="font-display text-2xl font-bold">Live venue intelligence.</h3>
                <p className="font-mono text-sm text-neutral-400 leading-relaxed">
                  Every card shows a live Vibe Score weighted by Scout Integrity AI.
                  Scores decay visually after 45 minutes — "67m ago" chips tell you
                  exactly how fresh the data is. Comparative framing shows
                  "Hotter than last Friday" so context replaces raw numbers.
                </p>
                <div className="space-y-3">
                  {[
                    ["Energy Decay", "Score opacity drops at 45m · STALE label at 90m"],
                    ["Scout Integrity", "Every rating weighted 0.3×–1.5× by AI reliability score"],
                    ["Comparative AI", "Hotter / Cooler vs. same time last week"],
                  ].map(([title, desc]) => (
                    <div key={title} className="flex gap-3">
                      <span className="text-viibe-cyan mt-0.5">→</span>
                      <div>
                        <span className="font-mono text-xs text-white font-bold">{title} </span>
                        <span className="font-mono text-xs text-neutral-500">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {active === "reactor" && (
              <div className="space-y-6">
                <h3 className="font-display text-2xl font-bold">The kinetic core.</h3>
                <p className="font-mono text-sm text-neutral-400 leading-relaxed">
                  The VibeReactor is the primary input mechanism. Scouts tap the orb rhythmically
                  to signal energy — the G-force of each tap is recorded, BPM is detected,
                  and the score updates live. Three gesture shortcuts let scouts fire a signal
                  without touching the screen.
                </p>
                <div className="space-y-3">
                  {[
                    ["Shake", "Sharp wrist flick — works anywhere, eyes-free"],
                    ["Raise to face", "Phone proximity + Z-axis transition"],
                    ["Back Tap", "iOS Accessibility shortcut, zero friction"],
                  ].map(([title, desc]) => (
                    <div key={title} className="flex gap-3">
                      <span className="text-purple-400 mt-0.5">⚡</span>
                      <div>
                        <span className="font-mono text-xs text-white font-bold">{title} </span>
                        <span className="font-mono text-xs text-neutral-500">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {active === "moment" && (
              <div className="space-y-6">
                <h3 className="font-display text-2xl font-bold">When the room erupts together.</h3>
                <p className="font-mono text-sm text-neutral-400 leading-relaxed">
                  When 5+ scouts fire a gesture within the same 8-second window,
                  a Moment Locks. Every scout's phone erupts simultaneously — haptic
                  sequence, shockwave rings, scout count animates up. The venue room
                  on Socket.IO broadcasts the event to everyone in the space.
                </p>
                <div className="neon-border p-4 bg-viibe-surface/50">
                  <p className="font-mono text-xs text-neutral-400 leading-relaxed">
                    <span className="text-white font-bold">The data moat:</span>{" "}
                    every Moment Lock is timestamped collective human emotion,
                    sensor-verified, stored permanently. No other platform captures this.
                  </p>
                </div>
              </div>
            )}
            {active === "memory" && (
              <div className="space-y-6">
                <h3 className="font-display text-2xl font-bold">The night, archived.</h3>
                <p className="font-mono text-sm text-neutral-400 leading-relaxed">
                  Memory Artifact generates a shareable post-night visual:
                  the energy arc (crowd signal density over time), Moment Lock markers,
                  peak scout count, and the venue's vibe signature.
                  Captured as PNG and shared to IG Stories, Snapchat, or native share sheet.
                </p>
                <div className="space-y-3">
                  {[
                    ["Energy Arc", "Skia sparkline of moment triggers — Moment Locks marked in red"],
                    ["IG Stories", "One tap to instagram-stories:// — no app required"],
                    ["Snapchat", "Opens Snap with image pre-loaded from camera roll"],
                  ].map(([title, desc]) => (
                    <div key={title} className="flex gap-3">
                      <span className="text-viibe-coral mt-0.5">→</span>
                      <div>
                        <span className="font-mono text-xs text-white font-bold">{title} </span>
                        <span className="font-mono text-xs text-neutral-500">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
