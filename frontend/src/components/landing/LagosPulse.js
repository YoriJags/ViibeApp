import { useState, useEffect, useRef } from "react";
import { Radio, Share2, TrendingUp } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TIER_COLORS = { electric: "#00F0FF", warming: "#FFD700", quiet: "#525252" };

function useCountUp(target, duration = 1000) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(start + diff * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export default function LagosPulse() {
  const [pulse, setPulse] = useState(null);
  const score = useCountUp(pulse ? Math.round(pulse.avg_vibe_score) : 0);

  useEffect(() => {
    const fetch = () => axios.get(`${API}/v1/agent/city/pulse?city=lagos`).then(r => setPulse(r.data)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, []);

  if (!pulse) return null;

  const circumference = 2 * Math.PI * 58;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? "#00F0FF" : score >= 60 ? "#FFD700" : "#FF3366";
  const shareText = `Lagos is at ${Math.round(pulse.avg_vibe_score)} energy right now. Where are you tonight?`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&hashtags=VIIBE`;

  return (
    <div className="neon-border bg-viibe-base/80 backdrop-blur-xl p-6 w-full max-w-sm" data-testid="lagos-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-viibe-cyan animate-glow-pulse" />
          <span className="font-mono text-[10px] text-viibe-cyan uppercase tracking-widest">Lagos Pulse</span>
        </div>
        <span className="font-mono text-[10px] text-viibe-coral uppercase tracking-widest flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-viibe-coral rounded-full animate-pulse" />
          Live
        </span>
      </div>

      {/* Score Ring */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <circle
              cx="70" cy="70" r="58"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease", filter: `drop-shadow(0 0 8px ${color}40)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-display text-4xl font-bold tabular-nums"
              style={{ color, textShadow: `0 0 20px ${color}40` }}
              data-testid="pulse-score"
            >
              {score}
            </span>
            <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider">City Energy</span>
          </div>
        </div>
      </div>

      {/* Energy Tiers */}
      <div className="space-y-1.5 mb-4">
        {Object.entries(pulse.energy_tiers).map(([tier, count]) => {
          const pct = pulse.total_venues > 0 ? (count / pulse.total_venues) * 100 : 0;
          return (
            <div key={tier} className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-neutral-500 uppercase w-14">{tier}</span>
              <div className="flex-1 h-1 bg-white/5 overflow-hidden">
                <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[tier] }} />
              </div>
              <span className="font-mono text-[9px] text-neutral-400 w-3 text-right">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Top Venues */}
      <div className="border-t border-white/5 pt-3 mb-3">
        <div className="flex items-center gap-1 mb-1.5">
          <TrendingUp size={10} className="text-viibe-gold" />
          <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider">Top Energy</span>
        </div>
        {pulse.top_venues.map((v) => (
          <div key={v.name} className="flex items-center justify-between font-mono text-[10px] py-0.5">
            <span className="text-neutral-400">{v.name}</span>
            <span className="text-viibe-cyan font-bold tabular-nums">{v.score}</span>
          </div>
        ))}
      </div>

      {/* Scouts + Share */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <span className="font-mono text-[9px] text-neutral-600">{pulse.active_scouts} scouts active</span>
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-[9px] text-neutral-500 hover:text-viibe-cyan transition-colors"
          data-testid="share-pulse"
        >
          <Share2 size={10} />
          Share
        </a>
      </div>
    </div>
  );
}
