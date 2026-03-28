import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import LagosHeatMap from "@/components/landing/LagosHeatMap";
import ProblemSection from "@/components/landing/ProblemSection";
import ProductShowcase from "@/components/landing/ProductShowcase";
import AppPreviewSection from "@/components/landing/AppPreviewSection";
import ApiSection from "@/components/landing/ApiSection";
import WaitlistSection from "@/components/landing/WaitlistSection";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <main className="bg-viibe-base min-h-screen text-white overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <LagosHeatMap />
      <ProblemSection />
      <ProductShowcase />
      <AppPreviewSection />
      <ApiSection />
      <WaitlistSection />
      <Footer />
    </main>
  );
}
