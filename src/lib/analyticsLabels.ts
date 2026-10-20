/** Friendly names for app paths and device time zones, shared by the admin analytics screens. */

export function pageLabel(path: string): string {
  if (path === "/") return "Home";
  const known: Record<string, string> = {
    "/products": "All products", "/shops": "Shops", "/cart": "Cart", "/checkout": "Checkout", "/orders": "My orders",
    "/wishlist": "Favourites", "/messages": "Messages", "/profile": "Profile", "/auth": "Sign in", "/sell": "Sell on Kano Kaftan",
    "/notifications": "Notifications", "/help": "Help", "/vendor/dashboard": "Seller dashboard", "/vendor/login": "Seller sign in",
  };
  if (known[path]) return known[path];
  const [, section, rest] = path.split("/");
  const name = rest ? decodeURIComponent(rest).replace(/-/g, " ") : "";
  if (section === "products" && name) return `Product · ${name}`;
  if (section === "shop" && name) return `Shop · ${name}`;
  if (section === "orders") return "Order details";
  if (section === "messages") return "Chat";
  if (section === "stories") return "Stories";
  if (section === "vendor") return `Seller dashboard${rest ? ` · ${rest.replace(/-/g, " ")}` : ""}`;
  if (section === "admin") return "Admin";
  if (section === "invite") return "Invite friends";
  if (section === "delivery") return "Delivery dashboard";
  if (section === "checkout") return "Checkout";
  return path;
}

/** Device time zones give a good idea of country without asking for location. */
export const ZONE_COUNTRIES: Record<string, string> = {
  "Africa/Lagos": "Nigeria", "Africa/Accra": "Ghana", "Africa/Abidjan": "Côte d'Ivoire", "Africa/Niamey": "Niger",
  "Africa/Douala": "Cameroon", "Africa/Ndjamena": "Chad", "Africa/Porto-Novo": "Benin", "Africa/Lome": "Togo",
  "Africa/Dakar": "Senegal", "Africa/Nairobi": "Kenya", "Africa/Johannesburg": "South Africa", "Africa/Cairo": "Egypt",
  "Africa/Khartoum": "Sudan", "Europe/London": "United Kingdom", "Europe/Dublin": "Ireland", "Europe/Paris": "France",
  "Europe/Berlin": "Germany", "Europe/Rome": "Italy", "Europe/Madrid": "Spain", "Europe/Amsterdam": "Netherlands",
  "Asia/Dubai": "UAE", "Asia/Riyadh": "Saudi Arabia", "Asia/Qatar": "Qatar", "Asia/Kolkata": "India", "Asia/Shanghai": "China",
  "America/New_York": "USA (East)", "America/Chicago": "USA (Central)", "America/Denver": "USA (Mountain)",
  "America/Los_Angeles": "USA (West)", "America/Toronto": "Canada", "Australia/Sydney": "Australia",
};
export function zoneLabel(zone: string): string {
  return ZONE_COUNTRIES[zone] ?? (zone === "Unknown" ? "Unknown" : zone.split("/").pop()!.replace(/_/g, " "));
}
