import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { ValueProps } from "@/components/home/ValueProps";
import { VendorCTA } from "@/components/home/VendorCTA";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ValueProps />
        <CategoryGrid />
        <FeaturedProducts />
        <VendorCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
