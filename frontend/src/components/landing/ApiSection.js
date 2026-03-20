import { useState, useEffect } from "react";
import { Terminal, ArrowRight } from "lucide-react";
import axios from "axios";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEMO_RESPONSE = {
  city: "lagos",
  count: 3,
  venues: [
    { id: "escape-vi", name: "Escape Nightclub", vibe_score: 91, energy_state: "peak", district: "Victoria Island" },
    { id: "quilox-vi", name: "Quilox", vibe_score: 87, energy_state: "electric", district: "Victoria Island" },
    { id: "club-joker-vi", name: "Club Joker", vibe_score: 83, energy_state: "electric", district: "Victoria Island" },
  ],
};

export default function ApiSection() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const curlCmd = `curl ${API}/v1/agent/venues/live?city=lagos&limit=3`;

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= curlCmd.length) {
        setTyped(curlCmd.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        fetchData();
      }
    }, 25);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/v1/agent/venues/live?city=lagos&limit=3`);
      setResponse(res.data);
    } catch {
      setResponse(DEMO_RESPONSE);
    }
    setLoading(false);
  };

  return (
    <section id="api" className="py-24 md:py-32 relative" data-testid="api-section">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-viibe-cyan/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-4">For AI Agents</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
          The data layer AI assistants query.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-2xl mb-12">
          "Where's the best energy in Lagos right now?" — Every AI assistant needs a data source. VIIBE is the only one with live, verified crowd intelligence.
        </p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Command */}
          <div className="neon-border bg-viibe-base p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={14} className="text-viibe-cyan" />
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Request</span>
            </div>
            <div className="bg-viibe-surface border border-white/5 p-5">
              <pre className="font-mono text-xs text-viibe-cyan whitespace-pre-wrap break-all">
                <span className="text-neutral-500">$</span> {typed}
                <span className="cursor-blink" />
              </pre>
            </div>
          </div>

          {/* Right: Response */}
          <div className="neon-border bg-viibe-base p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={14} className="text-emerald-400" />
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Response</span>
              {loading && <span className="font-mono text-[10px] text-viibe-gold animate-pulse">fetching...</span>}
            </div>
            <div className="bg-viibe-surface border border-white/5 p-5 max-h-72 overflow-auto">
              <pre className="font-mono text-xs text-emerald-400/80 whitespace-pre-wrap">
                {response ? JSON.stringify(response, null, 2) : "// awaiting response..."}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 font-mono text-sm text-viibe-cyan hover:text-white transition-colors group"
            data-testid="view-full-docs"
          >
            View full API documentation
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
