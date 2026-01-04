import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Store } from "lucide-react";

export function VendorCTA() {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 md:p-12">
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/10">
              <Store className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
              Start Selling on K²
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Join hundreds of vendors selling authentic Nigerian attire. 
              Reach customers across Nigeria and beyond.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button 
                size="lg" 
                variant="secondary"
                asChild
              >
                <Link to="/auth?mode=register&role=vendor">
                  Register as Vendor
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="ghost"
                className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                asChild
              >
                <Link to="/vendor/guide">
                  Learn More
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-foreground/5" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-foreground/5" />
        </div>
      </div>
    </section>
  );
}
