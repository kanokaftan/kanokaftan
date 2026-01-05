import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileHero } from "@/components/home/MobileHero";
import { CategoryPills } from "@/components/home/CategoryPills";
import { MobileFeaturedProducts } from "@/components/home/MobileFeaturedProducts";
import { FlashSalesSection } from "@/components/home/FlashSalesSection";
import { RecentlyViewed } from "@/components/products/RecentlyViewed";

const Index = () => {
  return (
    <MobileLayout>
      <MobileHero />
      <CategoryPills />
      <FlashSalesSection />
      <MobileFeaturedProducts />
      <RecentlyViewed />
    </MobileLayout>
  );
};

export default Index;
