import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Facebook, Instagram, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-primary text-primary-foreground">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo tile className="h-11 w-11" />
              <span className="font-display text-xl font-bold">Kano Kaftan</span>
            </Link>
            <p className="text-sm text-primary-foreground/80">
              Clothing, fabrics, shoes, caps and accessories from trusted sellers, with safe payments and delivery.
            </p>
            <div className="flex gap-4">
              <a 
                href="#" 
                className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-4">
            <h4 className="font-display text-lg font-semibold">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products?category=kaftan" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Kaftan
                </Link>
              </li>
              <li>
                <Link to="/products?category=shoes" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Shoes
                </Link>
              </li>
              <li>
                <Link to="/products?category=bags" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Bags
                </Link>
              </li>
              <li>
                <Link to="/products?category=caps" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Caps
                </Link>
              </li>
              <li>
                <Link to="/products?category=accessories" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Accessories
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="font-display text-lg font-semibold">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/chat" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/help" className="text-primary-foreground/80 hover:text-primary-foreground">
                  FAQs
                </Link>
              </li>
              <li>
                <Link to="/help" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link to="/help" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Returns Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Sellers */}
          <div className="space-y-4">
            <h4 className="font-display text-lg font-semibold">Sell on K²</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/sell" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Become a Vendor
                </Link>
              </li>
              <li>
                <Link to="/vendor/dashboard" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Vendor Dashboard
                </Link>
              </li>
              <li>
                <Link to="/shops" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Browse Shops
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/20 pt-8 text-center text-sm text-primary-foreground/60">
          <p>&copy; {new Date().getFullYear()} Kano Kaftan (K²). All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
