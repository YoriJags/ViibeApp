import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BOUNDS = { minLat: 6.4240, maxLat: 6.4520, minLng: 3.4150, maxLng: 3.4800 };
const MAP_W = 900, MAP_H = 420;

function toXY(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * MAP_W;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * MAP_H;
  return { x, y };
}

const scoreColor = (s) => s >= 80 ? "#00F0FF" : s >= 60 ? "#FFD700" : "#FF3366";
const scoreGlow = (s) => s >= 80 ? "rgba(0,240,255," : s >= 60 ? "rgba(255,215,0," : "rgba(255,51,102,";

export default function LagosHeatMap() {
  const [venues, setVenues] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    axios.get(`${API}/v1/agent/venues/live?city=lagos&limit=20`)
      .then(r => setVenues(r.data.venues))
      .catch(() => {});
  }, []);

  return (
    <section className="py-20 md:py-28 relative" data-testid="heatmap-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={14} className="text-viibe-gold" />
          <p className="font-mono text-xs text-viibe-gold uppercase tracking-widest">Live Map</p>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Lagos Energy Map
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-xl mb-10">
          Real-time energy across Victoria Island, Ikoyi, and Lekki Phase 1. Each dot is a live venue.
          Brighter means higher energy right now.
        </p>

        <div className="relative neon-border bg-viibe-base overflow-hidden">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            data-testid="heatmap-svg"
          >
            <defs>
              {venues.map((v) => {
                const c = scoreColor(v.vibe_score);
                return (
                  <radialGradient key={`grad-${v.id}`} id={`glow-${v.id}`}>
                    <stop offset="0%" stopColor={c} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={c} stopOpacity="0" />
                  </radialGradient>
                );
              })}
            </defs>

            {/* Grid */}
            {[...Array(15)].map((_, i) => (
              <line key={`vg-${i}`} x1={(i / 14) * MAP_W} y1={0} x2={(i / 14) * MAP_W} y2={MAP_H} stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
            ))}
            {[...Array(8)].map((_, i) => (
              <line key={`hg-${i}`} x1={0} y1={(i / 7) * MAP_H} x2={MAP_W} y2={(i / 7) * MAP_H} stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
            ))}

            {/* Districts */}
            <text x="100" y="310" fill="rgba(255,255,255,0.05)" fontSize="50" fontFamily="Unbounded, sans-serif" fontWeight="900">VICTORIA ISLAND</text>
            <text x="600" y="180" fill="rgba(255,255,255,0.05)" fontSize="36" fontFamily="Unbounded, sans-serif" fontWeight="900">LEKKI</text>
            <text x="340" y="80" fill="rgba(255,255,255,0.05)" fontSize="28" fontFamily="Unbounded, sans-serif" fontWeight="900">IKOYI</text>

            {/* Venue dots */}
            {venues.map((v) => {
              const coords = v.coordinates || {};
              if (!coords.lat || !coords.lng) return null;
              const { x, y } = toXY(coords.lat, coords.lng);
              const color = scoreColor(v.vibe_score);
              const active = hovered === v.id;
              const r = active ? 35 : 22 + (v.vibe_score / 100) * 10;

              return (
                <g
                  key={v.id}
                  onMouseEnter={() => setHovered(v.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Heat glow */}
                  <circle cx={x} cy={y} r={r} fill={`url(#glow-${v.id})`}>
                    <animate attributeName="r" values={`${r};${r + 6};${r}`} dur="3s" repeatCount="indefinite" />
                  </circle>

                  {/* Outer ring */}
                  <circle cx={x} cy={y} r={active ? 8 : 5} fill="none" stroke={color} strokeWidth="1" opacity={active ? 0.6 : 0.3}>
                    <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.5s" repeatCount="indefinite" />
                  </circle>

                  {/* Core */}
                  <circle cx={x} cy={y} r={active ? 4 : 3} fill={color} opacity={0.95} />
                  <circle cx={x} cy={y} r={1.5} fill="white" opacity={0.9} />

                  {/* Tooltip */}
                  {active && (
                    <g>
                      <rect x={x + 14} y={y - 34} width={155} height={52} rx="2" fill="rgba(5,5,5,0.95)" stroke={color} strokeWidth="1" />
                      <text x={x + 22} y={y - 16} fill="white" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700">{v.name}</text>
                      <text x={x + 22} y={y + 1} fill={color} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="500">
                        {v.vibe_score} {v.energy_state} · {v.capacity_pct}% cap
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-4 flex items-center gap-5 font-mono text-[9px] text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-viibe-cyan" /> Electric 80+</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-viibe-gold" /> Warming 60-79</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-viibe-coral" /> Quiet &lt;60</span>
          </div>

          {/* Count */}
          <div className="absolute top-3 right-4 font-mono text-[9px] text-neutral-600 uppercase tracking-wider">
            {venues.length} venues tracked · live
          </div>
        </div>
      </div>
    </section>
  );
}
