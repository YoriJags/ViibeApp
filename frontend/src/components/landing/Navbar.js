import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#problem", label: "Problem" },
    { href: "#product", label: "Product" },
    { href: "#api", label: "Agent API" },
    { href: "#waitlist", label: "Early Access" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        scrolled ? "bg-viibe-base/95 backdrop-blur-md border-b border-white/5" : "bg-transparent"
      }`}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="font-display text-xl font-bold tracking-tight" data-testid="nav-logo">
          V<span className="text-viibe-cyan">II</span>BE
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-xs text-neutral-400 hover:text-viibe-cyan transition-colors uppercase tracking-wider"
              data-testid={`nav-${link.label.toLowerCase().replace(' ', '-')}`}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#waitlist"
            className="font-mono text-xs text-viibe-cyan border border-viibe-cyan/30 px-5 py-2 hover:bg-viibe-cyan/10 transition-colors uppercase tracking-wider"
            data-testid="nav-join-waitlist"
          >
            Join Waitlist
          </a>
        </div>

        <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)} data-testid="mobile-menu-toggle">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-viibe-base/98 backdrop-blur-lg border-t border-white/5 px-6 py-6 space-y-4">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block font-mono text-sm text-neutral-300 hover:text-viibe-cyan transition-colors">
              {link.label}
            </a>
          ))}
          <a href="#waitlist" onClick={() => setMenuOpen(false)} className="block font-mono text-sm text-viibe-cyan">Join Waitlist</a>
        </div>
      )}
    </nav>
  );
}
