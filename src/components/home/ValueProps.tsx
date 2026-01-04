import { Truck, Shield, Users, Award } from "lucide-react";

const values = [
  {
    icon: Award,
    title: "Authentic Craftsmanship",
    description: "Every piece is handcrafted by skilled artisans from Kano",
  },
  {
    icon: Truck,
    title: "Nationwide Delivery",
    description: "Fast and reliable shipping to all 36 states",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Safe transactions with Paystack payment gateway",
  },
  {
    icon: Users,
    title: "Trusted Vendors",
    description: "Verified sellers with quality guarantees",
  },
];

export function ValueProps() {
  return (
    <section className="border-y bg-background py-12">
      <div className="container">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <div key={value.title} className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <value.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-primary">
                  {value.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {value.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
