import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileHero } from "@/components/home/MobileHero";
import { CategoryPills } from "@/components/home/CategoryPills";
import { MobileFeaturedProducts } from "@/components/home/MobileFeaturedProducts";

const Index = () => {
  return (
    <MobileLayout>
      <MobileHero />
      <CategoryPills />
      <MobileFeaturedProducts />
    </MobileLayout>
  );
};

export default Index;
