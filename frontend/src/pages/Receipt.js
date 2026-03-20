import { useState, useRef } from "react";
import { Download, Share2, ChevronLeft, Zap, MapPin, Clock, Users, Star } from "lucide-react";
import html2canvas from "html2canvas";

const API = process.env.REACT_APP_BACKEND_URL;

const VENUES = [
  { id: "quilox-vi", name: "Quilox" },
  { id: "shiro-vi", name: "Shiro Lagos" },
  { id: "escape-vi", name: "Escape Nightclub" },
  { id: "hardrock-vi", name: "Hard Rock Cafe" },
  { id: "nok-ikoyi", name: "NOK by Alara" },
  { id: "club-joker-vi", name: "Club Joker" },
  { id: "circa-lekki", name: "Circa Lekki" },
  { id: "sky-lounge-vi", name: "Sky Lounge" },
  { id: "rhapsodys-vi", name: "Rhapsody's" },
  { id: "eko-hotel", name: "Eko Hotel & Suites" },
];

const stateColor = {
  peak: "#FF3366",
  electric: "#00F0FF",
  warming: "#FFD700",
  steady: "#6B7280",
};

function ReceiptCard({ receipt }) {
  const cardRef = useRef(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#050505",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `viibe-receipt-${receipt.receipt_id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: copy text
      const text = `${receipt.tagline}\n\nVIIBE — Scene Intelligence`;
      navigator.clipboard.writeText(text);
    }
  };

  const handleShare = async () => {
    const text = `${receipt.tagline}\n\nCheck the energy at ${receipt.venue_name} on VIIBE.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "VIIBE Receipt", text });
      } catch {}
    } else {
      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(tweetUrl, "_blank");
    }
  };

  const scoreColor = stateColor[receipt.energy_state] || "#00F0FF";

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={cardRef}
        className="w-full max-w-sm border border-white/10 bg-viibe-base p-6"
        data-testid="receipt-card"
      >
        {/* Header */}
        <div className="border-b border-dashed border-white/10 pb-4 mb-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold tracking-tight">
              V<span style={{ color: "#00F0FF" }}>II</span>BE
            </p>
            <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest">
              #{receipt.receipt_id}
            </span>
          </div>
          <p className="font-mono text-[10px] text-neutral-600 mt-1">Scene Intelligence Receipt</p>
        </div>

        {/* Venue */}
        <div className="mb-4">
          <p className="font-display text-xl font-bold mb-1">{receipt.venue_name}</p>
          <div className="flex items-center gap-3 font-mono text-[10px] text-neutral-400">
            <span className="flex items-center gap-1">
              <MapPin size={9} /> {receipt.district}
            </span>
            <span className="uppercase">{receipt.category}</span>
          </div>
        </div>

        {/* Score Block */}
        <div
          className="border border-white/5 p-4 mb-4"
          style={{ background: `${scoreColor}08` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Energy Score</p>
              <p className="font-display text-4xl font-bold" style={{ color: scoreColor }}>
                {receipt.vibe_score}
              </p>
            </div>
            <div className="text-right">
              <p
                className="font-mono text-xs font-bold uppercase tracking-wider"
                style={{ color: scoreColor }}
              >
                {receipt.energy_state}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Users size={9} className="text-neutral-500" />
                <span className="font-mono text-[10px] text-neutral-500">{receipt.capacity_pct}% full</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-4 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-neutral-500">Scout</span>
            <span className="text-white">{receipt.scout_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Checked Out</span>
            <span className="text-white">{receipt.checked_out}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Peak Hour</span>
            <span className="text-neutral-300">{receipt.peak_hour}</span>
          </div>
        </div>

        {/* Tagline */}
        <div className="border-t border-dashed border-white/10 pt-4">
          <p className="font-mono text-[10px] text-neutral-400 italic leading-relaxed">
            "{receipt.tagline}"
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={8}
                className={receipt.vibe_score >= (i + 1) * 20 ? "text-viibe-gold fill-viibe-gold" : "text-neutral-700"}
              />
            ))}
          </div>
          <p className="font-mono text-[8px] text-neutral-600">viibe.app</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 font-mono text-xs bg-viibe-cyan/10 text-viibe-cyan border border-viibe-cyan/20 px-5 py-2.5 hover:bg-viibe-cyan/20 transition-colors"
          data-testid="receipt-download-btn"
        >
          <Download size={14} /> Download
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 font-mono text-xs bg-viibe-coral/10 text-viibe-coral border border-viibe-coral/20 px-5 py-2.5 hover:bg-viibe-coral/20 transition-colors"
          data-testid="receipt-share-btn"
        >
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  );
}

export default function Receipt() {
  const [selectedVenue, setSelectedVenue] = useState("");
  const [username, setUsername] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!selectedVenue) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/receipt/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue_id: selectedVenue, username: username || "Anonymous Scout" }),
      });
      if (!res.ok) throw new Error("Failed to generate receipt");
      const data = await res.json();
      setReceipt(data);
    } catch (err) {
      setError("Could not generate receipt. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-viibe-base min-h-screen text-white" data-testid="receipt-page">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl font-bold tracking-tight" data-testid="receipt-logo">
            V<span className="text-viibe-cyan">II</span>BE
          </a>
          <a
            href="/"
            className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors"
            data-testid="receipt-back-link"
          >
            <ChevronLeft size={14} /> Back
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-viibe-coral" />
            <span className="font-mono text-xs text-viibe-coral uppercase tracking-widest">Receipt Generator</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-3">
            "I Was There"
          </h1>
          <p className="font-mono text-sm text-neutral-500 max-w-md leading-relaxed">
            Generate your shareable checkout receipt from any Lagos scene. Prove you were part of the energy.
          </p>
        </div>

        {!receipt ? (
          <div className="space-y-6" data-testid="receipt-form">
            {/* Venue Select */}
            <div>
              <label className="block font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
                Select Venue
              </label>
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full bg-viibe-surface border border-white/10 text-white font-mono text-sm px-4 py-3 focus:outline-none focus:border-viibe-cyan/40 appearance-none"
                data-testid="receipt-venue-select"
              >
                <option value="">Choose a venue...</option>
                {VENUES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Username */}
            <div>
              <label className="block font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
                Your Scout Name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Anonymous Scout"
                className="w-full bg-viibe-surface border border-white/10 text-white font-mono text-sm px-4 py-3 focus:outline-none focus:border-viibe-cyan/40 placeholder:text-neutral-600"
                data-testid="receipt-username-input"
              />
            </div>

            {error && (
              <p className="font-mono text-xs text-viibe-coral" data-testid="receipt-error">{error}</p>
            )}

            <button
              onClick={handleGenerate}
              disabled={!selectedVenue || loading}
              className="font-mono text-sm bg-viibe-cyan text-viibe-base px-8 py-3 font-bold hover:bg-viibe-cyan/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="receipt-generate-btn"
            >
              {loading ? "Generating..." : "Generate Receipt"}
            </button>
          </div>
        ) : (
          <div>
            <ReceiptCard receipt={receipt} />
            <button
              onClick={() => setReceipt(null)}
              className="mt-8 font-mono text-xs text-neutral-500 hover:text-viibe-cyan transition-colors"
              data-testid="receipt-new-btn"
            >
              Generate another receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
