import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import ProductShowcase from "@/components/landing/ProductShowcase";
import ApiSection from "@/components/landing/ApiSection";
import WaitlistSection from "@/components/landing/WaitlistSection";
import Footer from "@/components/landing/Footer";
import ReactorModal from "@/components/landing/ReactorModal";

export default function Landing() {
  const [reactorOpen, setReactorOpen] = useState(false);

  return (
    <main className="bg-viibe-base min-h-screen text-white overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <ProductShowcase onOpenReactor={() => setReactorOpen(true)} />
      <ApiSection />
      <WaitlistSection />
      <Footer />
      <ReactorModal isOpen={reactorOpen} onClose={() => setReactorOpen(false)} />
    </main>
  );
}
