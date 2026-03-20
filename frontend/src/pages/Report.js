import { useState, useEffect } from "react";
import { ChevronLeft, TrendingUp, TrendingDown, Activity, Users, Calendar, Zap, BarChart3, MapPin } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const tierColor = { electric: "#00F0FF", warming: "#FFD700", quiet: "#FF3366" };
const catIcons = { nightclub: Zap, lounge: Activity, restaurant: MapPin, bar: BarChart3, event_space: Calendar };

function StatCard({ label, value, accent, icon: Icon }) {
  return (
    <div className="border border-white/5 bg-viibe-surface p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={10} className="text-neutral-500" />}
        <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold" style={{ color: accent || "#fff" }}>
        {value}
      </p>
    </div>
  );
}

function VenueRow({ venue, rank }) {
  const scoreColor = venue.score >= 80 ? "#00F0FF" : venue.score >= 60 ? "#FFD700" : "#FF3366";
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0" data-testid={`venue-row-${rank}`}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-neutral-600 w-5">{rank}</span>
        <div>
          <p className="font-mono text-sm text-white">{venue.name}</p>
          <p className="font-mono text-[10px] text-neutral-500">{venue.district} — {venue.category}</p>
        </div>
      </div>
      <span className="font-display text-lg font-bold tabular-nums" style={{ color: scoreColor }}>
        {venue.score}
      </span>
    </div>
  );
}

export default function Report() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/report/weekly`)
      .then((r) => r.json())
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-viibe-base min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-neutral-500 animate-pulse">Loading report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-viibe-base min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-viibe-coral">Failed to load report.</p>
      </div>
    );
  }

  const s = report.summary;

  return (
    <div className="bg-viibe-base min-h-screen text-white" data-testid="report-page">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl font-bold tracking-tight" data-testid="report-logo">
            V<span className="text-viibe-cyan">II</span>BE
          </a>
          <a href="/" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors" data-testid="report-back-link">
            <ChevronLeft size={14} /> Back
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-viibe-gold" />
            <span className="font-mono text-xs text-viibe-gold uppercase tracking-widest">Weekly Report</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Lagos Scene Report
          </h1>
          <p className="font-mono text-sm text-neutral-500">{report.report_week}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          <StatCard label="Venues Tracked" value={s.total_venues} icon={MapPin} />
          <StatCard label="Avg Energy" value={s.avg_energy} accent="#00F0FF" icon={Activity} />
          <StatCard label="Active Scouts" value={s.active_scouts} accent="#FFD700" icon={Users} />
          <StatCard label="Peak Night" value={s.peak_night} accent="#FF3366" icon={Calendar} />
        </div>

        {/* Energy Tiers */}
        <div className="mb-12">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">Energy Distribution</h2>
          <div className="flex gap-2 h-8">
            {Object.entries(report.energy_tiers).map(([tier, count]) => {
              const total = Object.values(report.energy_tiers).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div
                  key={tier}
                  className="flex items-center justify-center font-mono text-[10px] font-bold transition-all"
                  style={{
                    width: `${Math.max(pct, 10)}%`,
                    backgroundColor: `${tierColor[tier]}18`,
                    border: `1px solid ${tierColor[tier]}30`,
                    color: tierColor[tier],
                  }}
                  data-testid={`tier-${tier}`}
                >
                  {count} {tier}
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Column: Top Venues + District Breakdown */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Top Venues */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={12} className="text-viibe-cyan" />
              <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider">Top Venues</h2>
            </div>
            <div className="border border-white/5 bg-viibe-surface p-4" data-testid="top-venues-list">
              {report.top_venues.map((v, i) => (
                <VenueRow key={v.name} venue={v} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Coldest */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={12} className="text-viibe-coral" />
              <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider">Coldest Venues</h2>
            </div>
            <div className="border border-white/5 bg-viibe-surface p-4" data-testid="cold-venues-list">
              {report.coldest_venues.map((v, i) => (
                <VenueRow key={v.name} venue={v} rank={i + 1} />
              ))}
            </div>
          </div>
        </div>

        {/* District Breakdown */}
        <div className="mb-12">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">District Energy</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(report.district_breakdown).map(([district, avg]) => {
              const color = avg >= 80 ? "#00F0FF" : avg >= 60 ? "#FFD700" : "#FF3366";
              return (
                <div key={district} className="border border-white/5 bg-viibe-surface p-4" data-testid={`district-${district.toLowerCase().replace(/\s/g, '-')}`}>
                  <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{district}</p>
                  <p className="font-display text-2xl font-bold" style={{ color }}>{avg}</p>
                  <div className="mt-2 h-1 bg-white/5">
                    <div className="h-full transition-all" style={{ width: `${avg}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="mb-12">
          <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">Category Breakdown</h2>
          <div className="border border-white/5 bg-viibe-surface p-4 space-y-3" data-testid="category-breakdown">
            {Object.entries(report.category_breakdown).map(([cat, avg]) => {
              const color = avg >= 80 ? "#00F0FF" : avg >= 60 ? "#FFD700" : "#FF3366";
              const Icon = catIcons[cat] || Activity;
              return (
                <div key={cat} className="flex items-center gap-4">
                  <Icon size={12} style={{ color }} />
                  <span className="font-mono text-xs text-neutral-400 uppercase w-28">{cat.replace('_', ' ')}</span>
                  <div className="flex-1 h-2 bg-white/5">
                    <div className="h-full transition-all" style={{ width: `${avg}%`, backgroundColor: color }} />
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums" style={{ color }}>{avg}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trending */}
        {report.trending.length > 0 && (
          <div className="mb-12">
            <h2 className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">Trending This Week</h2>
            <div className="flex flex-wrap gap-2" data-testid="trending-list">
              {report.trending.map((v) => (
                <div
                  key={v.name}
                  className="border border-viibe-cyan/20 bg-viibe-cyan/5 px-3 py-1.5 font-mono text-xs text-viibe-cyan"
                >
                  {v.name} — {v.score}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share CTA */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="font-mono text-[10px] text-neutral-600">
            Generated by VIIBE Scene Intelligence — {report.report_week}
          </p>
          <button
            onClick={() => {
              const text = `Lagos Scene Report: Avg energy ${s.avg_energy} | ${s.total_venues} venues | Peak night: ${s.peak_night}\n\nPowered by VIIBE — Scene Intelligence`;
              const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
              window.open(url, "_blank");
            }}
            className="font-mono text-xs bg-viibe-cyan/10 text-viibe-cyan border border-viibe-cyan/20 px-4 py-2 hover:bg-viibe-cyan/20 transition-colors"
            data-testid="report-share-btn"
          >
            Share Report on X
          </button>
        </div>
      </div>
    </div>
  );
}
