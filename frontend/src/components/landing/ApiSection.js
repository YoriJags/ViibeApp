import { useState, useEffect } from "react";
import { Terminal, ArrowRight, Cpu } from "lucide-react";
import axios from "axios";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEMO_RESPONSE = {
  city: "lagos",
  generated_at: new Date().toISOString(),
  count: 3,
  venues: [
    { id: "escape-vi",    name: "Escape",      vibe_score: 91, energy_state: "peak",     district: "Victoria Island", last_rated_mins_ago: 3,  moment_locks_tonight: 2 },
    { id: "quilox-vi",    name: "Quilox",       vibe_score: 87, energy_state: "electric", district: "Victoria Island", last_rated_mins_ago: 7,  moment_locks_tonight: 1 },
    { id: "club-joker-vi",name: "Club Joker",   vibe_score: 83, energy_state: "electric", district: "Victoria Island", last_rated_mins_ago: 12, moment_locks_tonight: 0 },
  ],
};

const AI_CONSUMERS = [
  { name: "ChatGPT",   label: "Actions" },
  { name: "Claude",    label: "MCP" },
  { name: "Perplexity",label: "Search" },
  { name: "Siri",      label: "Shortcuts" },
  { name: "Hotel Apps",label: "Concierge" },
];

export default function ApiSection() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [typed,   setTyped]     = useState("");
  const curlCmd = `curl ${API}/v1/agent/venues/live?city=lagos&limit=3`;

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= curlCmd.length) { setTyped(curlCmd.slice(0, i)); i++; }
      else { clearInterval(interval); fetchData(); }
    }, 22);
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-viibe-cyan/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <p className="font-mono text-xs text-viibe-cyan uppercase tracking-widest mb-4">For AI Agents</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
          The ground truth AI assistants are missing.
        </h2>
        <p className="font-mono text-sm text-neutral-500 max-w-2xl mb-4 leading-relaxed">
          ChatGPT, Claude, Perplexity — every AI assistant is starving for real-world, real-time data.
          They can tell you anything except what's happening right now, in a physical space, at the human level.
          VIIBE is the only source that exists.
        </p>

        {/* AI consumer pills */}
        <div className="flex flex-wrap gap-2 mb-12">
          {AI_CONSUMERS.map(c => (
            <div key={c.name} className="flex items-center gap-2 border border-viibe-cyan/15 bg-viibe-cyan/5 px-3 py-1.5">
              <Cpu size={10} className="text-viibe-cyan/60" />
              <span className="font-mono text-[10px] text-white/70 font-semibold">{c.name}</span>
              <span className="font-mono text-[9px] text-viibe-cyan/50 uppercase tracking-wider">{c.label}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Request */}
          <div className="neon-border bg-viibe-base p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={14} className="text-viibe-cyan" />
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Request</span>
            </div>
            <div className="bg-viibe-surface border border-white/5 p-5">
              <pre className="font-mono text-xs text-viibe-cyan whitespace-pre-wrap break-all">
                <span className="text-neutral-500">$</span> {typed}
                <span className="animate-pulse">▌</span>
              </pre>
            </div>
          </div>

          {/* Response */}
          <div className="neon-border bg-viibe-base p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={14} className="text-emerald-400" />
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Response</span>
              {loading && <span className="font-mono text-[10px] text-viibe-gold animate-pulse">fetching live data...</span>}
            </div>
            <div className="bg-viibe-surface border border-white/5 p-5 max-h-72 overflow-auto">
              <pre className="font-mono text-xs text-emerald-400/80 whitespace-pre-wrap">
                {response ? JSON.stringify(response, null, 2) : "// awaiting response..."}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 font-mono text-sm text-viibe-cyan hover:text-white transition-colors group"
            data-testid="view-full-docs"
          >
            View full API documentation
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <span className="font-mono text-[10px] text-neutral-600 uppercase tracking-wider">
            Moment Lock webhooks · City pulse · Venue detail · Historical curves
          </span>
        </div>
      </div>
    </section>
  );
}
