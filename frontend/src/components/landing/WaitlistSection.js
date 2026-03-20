import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const roles = [
  { value: "scout", label: "Scout", desc: "I go out and want to find the energy" },
  { value: "venue_owner", label: "Venue Owner", desc: "I run a venue and want analytics" },
  { value: "developer", label: "Developer", desc: "I want to integrate the Agent API" },
];

export default function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("scout");
  const [status, setStatus] = useState("idle");
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setError("");
    try {
      const res = await axios.post(`${API}/waitlist`, { email, role, city: "lagos" });
      setPosition(res.data.position);
      setStatus("success");
    } catch (err) {
      if (err.response?.status === 409) {
        setError("You're already on the list.");
      } else {
        setError("Something went wrong. Try again.");
      }
      setStatus("error");
    }
  };

  return (
    <section id="waitlist" className="py-24 md:py-32 relative" data-testid="waitlist-section">
      {/* Background marquee */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        <div className="marquee-track whitespace-nowrap py-20">
          {Array(4).fill(null).map((_, i) => (
            <span key={i} className="font-display text-[120px] font-bold tracking-tight mx-8">
              VIIBE LIVE DATA VIIBE LIVE DATA
            </span>
          ))}
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-gold uppercase tracking-widest mb-4">Early access</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
          The energy is live.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-xl mb-12">
          VIIBE is launching in Lagos. Join the founding network — scouts, venue
          operators, and developers building on the scene intelligence layer.
        </p>

        {status === "success" ? (
          <div className="neon-border bg-viibe-surface p-8" data-testid="waitlist-success">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-viibe-cyan/20 flex items-center justify-center">
                <Check size={16} className="text-viibe-cyan" />
              </div>
              <h3 className="font-display text-lg font-bold">You're in.</h3>
            </div>
            <p className="font-mono text-sm text-neutral-400">
              Position <span className="text-viibe-cyan font-bold">#{position}</span> on the waitlist.
              We'll reach out before launch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="waitlist-form">
            {/* Role selector */}
            <div className="grid grid-cols-3 gap-3">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-4 border text-left transition-all duration-200 ${
                    role === r.value
                      ? "border-viibe-cyan bg-viibe-cyan/5"
                      : "border-white/10 bg-viibe-surface hover:border-white/20"
                  }`}
                  data-testid={`role-${r.value}`}
                >
                  <p className={`font-mono text-xs font-bold mb-1 ${role === r.value ? "text-viibe-cyan" : "text-white"}`}>
                    {r.label}
                  </p>
                  <p className="font-mono text-[10px] text-neutral-500 leading-relaxed">{r.desc}</p>
                </button>
              ))}
            </div>

            {/* Email input */}
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 bg-viibe-surface border border-white/10 px-4 py-3 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-viibe-cyan focus:outline-none focus:ring-1 focus:ring-viibe-cyan/30 transition-colors"
                data-testid="waitlist-email-input"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-viibe-cyan text-viibe-base px-6 py-3 font-mono text-sm font-bold hover:bg-viibe-cyan/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                data-testid="waitlist-submit"
              >
                {status === "loading" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Join <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="font-mono text-xs text-viibe-coral" data-testid="waitlist-error">{error}</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
