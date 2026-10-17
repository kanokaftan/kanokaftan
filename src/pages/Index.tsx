import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileHero } from "@/components/home/MobileHero";
import { CategoryPills } from "@/components/home/CategoryPills";
import { FeaturedShopsStrip } from "@/components/home/FeaturedShopsStrip";
import { PartnerSpotlight } from "@/components/home/PartnerSpotlight";
import { StoryStrip } from "@/components/stories/StoryStrip";
import { MobileFeaturedProducts } from "@/components/home/MobileFeaturedProducts";
import { AllProductsSection } from "@/components/home/AllProductsSection";
import { TopShopsSection } from "@/components/home/TopShopsSection";
import { FlashSalesSection } from "@/components/home/FlashSalesSection";
import { RecentlyViewed } from "@/components/products/RecentlyViewed";
import { PushPrompt } from "@/components/notifications/PushPrompt";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <MobileLayout headerSearch>
      <MobileHero />
      <PushPrompt />
      <StoryStrip />
      <CategoryPills />
      <PartnerSpotlight />
      <FeaturedShopsStrip />
      <FlashSalesSection />
      <MobileFeaturedProducts />
      <TopShopsSection />
      <AllProductsSection />
      <RecentlyViewed />
      <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-4 py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Kano Kaftan</span>
        <Link to="/help" className="underline hover:text-primary">Help</Link>
        <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>
        <Link to="/terms" className="underline hover:text-primary">Terms of Service</Link>
      </nav>
    </MobileLayout>
  );
};

export default Index;
