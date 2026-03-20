import { useState, useEffect } from "react";
import { ArrowLeft, Copy, Check, Zap, Globe, Key } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const endpoints = [
  {
    method: "GET",
    path: "/v1/agent/venues/live",
    params: "?city=lagos&limit=3",
    description: "Top venues by live energy score, filterable by city and category",
  },
  {
    method: "GET",
    path: "/v1/agent/venues/{venue_id}",
    params: "",
    description: "Single venue real-time snapshot — score, capacity, gate, trend status",
  },
  {
    method: "GET",
    path: "/v1/agent/city/pulse",
    params: "?city=lagos",
    description: "City-level energy summary — avg score, tier breakdown, top 3 venues",
  },
];

function EndpointCard({ ep, activeResponse, onTry }) {
  const [copied, setCopied] = useState(false);
  const curl = `curl -H "X-Agent-Key: YOUR_KEY" \\
  ${API}${ep.path}${ep.params}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="neon-border bg-viibe-surface p-6 mb-4" data-testid={`endpoint-${ep.path.replace(/\//g, '-')}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-mono px-2 py-0.5">{ep.method}</span>
        <code className="text-viibe-cyan font-mono text-sm">{ep.path}{ep.params}</code>
      </div>
      <p className="text-neutral-400 font-mono text-xs mb-4">{ep.description}</p>
      <div className="bg-viibe-base border border-white/5 p-4 mb-3 relative">
        <button onClick={handleCopy} className="absolute top-2 right-2 text-neutral-500 hover:text-viibe-cyan transition-colors" data-testid={`copy-${ep.method}`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap">{curl}</pre>
      </div>
      <button
        onClick={() => onTry(ep)}
        className="font-mono text-xs text-viibe-cyan hover:text-white border border-viibe-cyan/30 px-3 py-1.5 hover:bg-viibe-cyan/10 transition-colors"
        data-testid={`try-${ep.method}-${ep.path.split('/').pop()}`}
      >
        Try it live
      </button>
      {activeResponse && (
        <div className="mt-3 bg-viibe-base border border-viibe-cyan/20 p-4 max-h-64 overflow-auto">
          <pre className="text-xs font-mono text-viibe-cyan/80 whitespace-pre-wrap">{JSON.stringify(activeResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function ApiDocs() {
  const [responses, setResponses] = useState({});

  const handleTry = async (ep) => {
    try {
      const url = ep.path.includes("{venue_id}")
        ? `${API}/v1/agent/venues/quilox-vi`
        : `${API}${ep.path}${ep.params}`;
      const res = await axios.get(url);
      setResponses((prev) => ({ ...prev, [ep.path]: res.data }));
    } catch (err) {
      setResponses((prev) => ({ ...prev, [ep.path]: { error: err.message } }));
    }
  };

  return (
    <main className="bg-viibe-base min-h-screen text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-viibe-cyan font-mono text-sm mb-8 transition-colors" data-testid="back-to-home">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="mb-12">
          <p className="font-mono text-xs text-viibe-cyan tracking-widest uppercase mb-4">Agent API v1</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">VIIBE Agent API</h1>
          <p className="font-mono text-neutral-400 text-sm max-w-2xl">
            Real-time venue energy data for AI agents, travel apps, and hotel concierge systems.
            Returns live Vibe Scores, crowd states, and city pulse summaries.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <div className="neon-border bg-viibe-surface p-5">
            <Zap size={18} className="text-viibe-cyan mb-3" />
            <p className="font-mono text-xs text-neutral-400">Real-time data updated every 60 seconds from live scout network</p>
          </div>
          <div className="neon-border bg-viibe-surface p-5">
            <Globe size={18} className="text-viibe-coral mb-3" />
            <p className="font-mono text-xs text-neutral-400">REST API — works with ChatGPT Actions, Claude MCP, Perplexity</p>
          </div>
          <div className="neon-border bg-viibe-surface p-5">
            <Key size={18} className="text-viibe-gold mb-3" />
            <p className="font-mono text-xs text-neutral-400">API key auth via X-Agent-Key header or ?api_key= param</p>
          </div>
        </div>

        <h2 className="font-display text-xl font-bold mb-6">Endpoints</h2>
        {endpoints.map((ep) => (
          <EndpointCard key={ep.path} ep={ep} activeResponse={responses[ep.path]} onTry={handleTry} />
        ))}

        <div className="mt-12 neon-border bg-viibe-surface p-8">
          <h3 className="font-display text-lg font-bold mb-3">Get API Access</h3>
          <p className="font-mono text-sm text-neutral-400 mb-4">
            Request an API key to integrate VIIBE data into your application.
          </p>
          <a href="mailto:yoriajagun08@gmail.com?subject=VIIBE Agent API Key Request" className="inline-block font-mono text-sm bg-viibe-cyan text-viibe-base px-5 py-2.5 font-bold hover:bg-viibe-cyan/90 transition-colors" data-testid="request-api-key">
            Request API Key
          </a>
        </div>
      </div>
    </main>
  );
}
