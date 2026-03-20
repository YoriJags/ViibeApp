import { Mail, Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Brand */}
          <div>
            <p className="font-display text-xl font-bold tracking-tight mb-3">
              V<span className="text-viibe-cyan">II</span>BE
            </p>
            <p className="font-mono text-xs text-neutral-500 leading-relaxed">
              Scene Intelligence Terminal.
              <br />
              Lagos, Nigeria. 2026.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">Product</p>
            <div className="space-y-2">
              <a href="#product" className="block font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">Scout Floor</a>
              <a href="#product" className="block font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">Merchant Floor</a>
              <a href="#api" className="block font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">Agent API</a>
              <a href="#waitlist" className="block font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">Early Access</a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-mono text-xs text-neutral-500 uppercase tracking-wider mb-4">Connect</p>
            <div className="space-y-2">
              <a href="mailto:yoriajagun08@gmail.com" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">
                <Mail size={12} /> yoriajagun08@gmail.com
              </a>
              <a href="https://vibe-app-theta.vercel.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors">
                <Globe size={12} /> vibe-app-theta.vercel.app
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p className="font-mono text-[10px] text-neutral-600">
            &copy; 2026 VIIBE. Scene Intelligence.
          </p>
          <p className="font-mono text-[10px] text-neutral-700">
            "The app is the acquisition engine. The terminal is the business."
          </p>
        </div>
      </div>
    </footer>
  );
}
