import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const SKINS = [
  { name: "Neon Bloom", id: "neon-bloom" },
  { name: "Solar Flare", id: "solar-flare" },
  { name: "Deep Bass", id: "deep-bass" },
  { name: "Lagos Nights", id: "lagos-nights" },
];

const VENUES = [
  { name: "Escape Nightclub", district: "Victoria Island", score: 91 },
  { name: "Quilox", district: "Victoria Island", score: 87 },
  { name: "Club Joker", district: "Victoria Island", score: 83 },
];

/* ── Animation renderers ──────────────────────────── */

function drawNeonBloom(ctx, w, h, score, t) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, s = score / 100;
  const hue = score >= 80 ? 186 : score >= 60 ? 48 : 344;

  // Expanding rings
  for (let i = 0; i < 10; i++) {
    const phase = t * 0.0008 * (1 + s * 0.5) + i * 0.6;
    const r = 30 + i * 38 + Math.sin(phase) * 15 * s;
    const a = (1 - i / 10) * 0.25 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 100%, 55%, ${a})`;
    ctx.lineWidth = 1.5 + s * 2;
    ctx.shadowColor = `hsla(${hue}, 100%, 55%, 0.4)`;
    ctx.shadowBlur = 18 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Orbiting particles
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + t * 0.001 * (1 + s);
    const radius = 80 + Math.sin(t * 0.002 + i * 0.7) * 60;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${0.5 * s})`;
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }

  // Center orb
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * s + 20);
  g.addColorStop(0, `hsla(${hue}, 100%, 75%, ${0.7 * s})`);
  g.addColorStop(0.6, `hsla(${hue}, 100%, 50%, ${0.15 * s})`);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSolarFlare(ctx, w, h, score, t) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, s = score / 100;

  // Rotating beams
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + t * 0.0004 * (1 + s);
    const len = 150 + Math.sin(t * 0.0015 + i * 0.8) * 120 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255, 51, 102, ${0.5 * s})`);
    g.addColorStop(0.4, `rgba(255, 215, 0, ${0.25 * s})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  // Pulsing center
  const pulse = 1 + Math.sin(t * 0.003) * 0.15 * s;
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * pulse);
  cg.addColorStop(0, `rgba(255, 240, 200, ${0.85 * s})`);
  cg.addColorStop(0.25, `rgba(255, 100, 50, ${0.5 * s})`);
  cg.addColorStop(0.6, `rgba(255, 51, 102, ${0.2 * s})`);
  cg.addColorStop(1, "transparent");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, 90 * pulse, 0, Math.PI * 2);
  ctx.fill();
}

function drawDeepBass(ctx, w, h, score, t) {
  ctx.clearRect(0, 0, w, h);
  const s = score / 100, cy = h / 2;

  for (let wave = 0; wave < 7; wave++) {
    const yOff = (wave - 3) * 35;
    const hue = 186 + wave * 25;
    const a = (1 - Math.abs(wave - 3) / 3) * 0.55 * s;

    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const freq = 0.004 + wave * 0.0015;
      const amp = (25 + wave * 12) * s;
      const phase = t * 0.0018 * (1 + s * 0.4) + wave * 0.6;
      const env = Math.sin((x / w) * Math.PI);
      const y = cy + yOff + Math.sin(x * freq + phase) * amp * env;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${hue}, 100%, 55%, ${a})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `hsla(${hue}, 100%, 55%, 0.45)`;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Center horizontal glow
  const g = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, w * 0.35);
  g.addColorStop(0, `rgba(0, 240, 255, ${0.08 * s})`);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawLagosNights(ctx, w, h, score, t, pts) {
  ctx.clearRect(0, 0, w, h);
  const s = score / 100, cx = w / 2, cy = h / 2;

  // Stars
  pts.forEach((p, i) => {
    const flicker = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.0008 + i * 1.7));
    ctx.fillStyle = `rgba(255,255,255,${flicker * 0.35 * s})`;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  });

  // Connection lines
  pts.forEach((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 220) {
      const a = (1 - d / 220) * 0.12 * s;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x + Math.sin(t * 0.0003) * 5, p.y);
      ctx.strokeStyle = `rgba(0,240,255,${a})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  });

  // Center orb
  const pulse = 1 + Math.sin(t * 0.0025) * 0.18 * s;
  const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, 65 * pulse);
  og.addColorStop(0, `rgba(0,240,255,${0.85 * s})`);
  og.addColorStop(0.3, `rgba(120,50,255,${0.35 * s})`);
  og.addColorStop(0.6, `rgba(255,51,102,${0.12 * s})`);
  og.addColorStop(1, "transparent");
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(cx, cy, 65 * pulse, 0, Math.PI * 2);
  ctx.fill();
}

/* ── Component ──────────────────────────── */

export default function ReactorModal({ isOpen, onClose }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const ptsRef = useRef([]);
  const [skinIdx, setSkinIdx] = useState(0);
  const [venueIdx, setVenueIdx] = useState(0);
  const [score, setScore] = useState(VENUES[0].score);

  // Generate star particles once
  useEffect(() => {
    ptsRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      s: Math.random() * 2 + 0.5,
    }));
  }, []);

  // Canvas animation loop
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const fns = [drawNeonBloom, drawSolarFlare, drawDeepBass, drawLagosNights];
    const loop = (t) => {
      const fn = fns[skinIdx];
      skinIdx === 3 ? fn(ctx, canvas.width, canvas.height, score, t, ptsRef.current)
                     : fn(ctx, canvas.width, canvas.height, score, t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [isOpen, skinIdx, score]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setSkinIdx((i) => (i + 1) % SKINS.length);
      if (e.key === "ArrowLeft") setSkinIdx((i) => (i - 1 + SKINS.length) % SKINS.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const v = VENUES[venueIdx];
  const c = score >= 80 ? "#00F0FF" : score >= 60 ? "#FFD700" : "#FF3366";
  const g = score >= 80 ? "rgba(0,240,255,0.3)" : score >= 60 ? "rgba(255,215,0,0.3)" : "rgba(255,51,102,0.3)";

  return (
    <div className="fixed inset-0 z-50 bg-viibe-base" data-testid="reactor-modal">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Top */}
        <div className="flex items-center justify-between p-6">
          <div>
            <p className="font-mono text-[10px] text-viibe-coral uppercase tracking-widest mb-1">VibeReactor</p>
            <p className="font-display text-lg font-bold">{SKINS[skinIdx].name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border border-white/10 hover:border-viibe-cyan/30 transition-colors"
            data-testid="reactor-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center">
            <p
              className="font-display text-7xl md:text-9xl font-bold tabular-nums"
              style={{ color: c, textShadow: `0 0 50px ${g}` }}
              data-testid="reactor-score"
            >
              {score}
            </p>
            <p className="font-display text-xl font-bold mt-2 mb-1">{v.name}</p>
            <p className="font-mono text-xs text-neutral-500">{v.district}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-5">
          {/* Slider */}
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <span className="font-mono text-[10px] text-neutral-500 w-12">ENERGY</span>
            <input
              type="range" min="20" max="99" value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="flex-1 h-1 bg-white/10 appearance-none cursor-pointer accent-viibe-cyan
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-viibe-cyan
                [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-viibe-cyan [&::-moz-range-thumb]:border-0"
              data-testid="reactor-slider"
            />
            <span className="font-mono text-xs text-viibe-cyan tabular-nums w-6 text-right">{score}</span>
          </div>

          {/* Skin nav */}
          <div className="flex items-center justify-center gap-5">
            <button onClick={() => setSkinIdx((i) => (i - 1 + SKINS.length) % SKINS.length)} className="text-neutral-500 hover:text-white transition-colors" data-testid="reactor-prev-skin">
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-2.5">
              {SKINS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSkinIdx(i)}
                  className={`w-2 h-2 transition-all ${i === skinIdx ? "bg-viibe-cyan scale-125" : "bg-white/15 hover:bg-white/30"}`}
                  data-testid={`reactor-skin-${s.id}`}
                />
              ))}
            </div>
            <button onClick={() => setSkinIdx((i) => (i + 1) % SKINS.length)} className="text-neutral-500 hover:text-white transition-colors" data-testid="reactor-next-skin">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Venue pills */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {VENUES.map((venue, i) => (
              <button
                key={venue.name}
                onClick={() => { setVenueIdx(i); setScore(venue.score); }}
                className={`font-mono text-[10px] px-3 py-1.5 border transition-all ${
                  i === venueIdx
                    ? "border-viibe-cyan text-viibe-cyan bg-viibe-cyan/5"
                    : "border-white/8 text-neutral-500 hover:border-white/15"
                }`}
                data-testid={`reactor-venue-${i}`}
              >
                {venue.name}
              </button>
            ))}
          </div>

          <p className="text-center font-mono text-[8px] text-neutral-700">
            Arrow keys to switch skin &middot; Drag slider to change energy level
          </p>
        </div>
      </div>
    </div>
  );
}
