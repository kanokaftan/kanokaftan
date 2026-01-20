import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileHero } from "@/components/home/MobileHero";
import { CategoryPills } from "@/components/home/CategoryPills";
import { MobileFeaturedProducts } from "@/components/home/MobileFeaturedProducts";
import { AllProductsSection } from "@/components/home/AllProductsSection";
import { FlashSalesSection } from "@/components/home/FlashSalesSection";
import { RecentlyViewed } from "@/components/products/RecentlyViewed";

const Index = () => {
  return (
    <MobileLayout>
      <MobileHero />
      <CategoryPills />
      <FlashSalesSection />
      <MobileFeaturedProducts />
      <AllProductsSection />
      <RecentlyViewed />
    </MobileLayout>
  );
};

export default Index;
