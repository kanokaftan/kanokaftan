import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryCache } from "@/lib/persistQueryCache";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Analytics } from "@vercel/analytics/react";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import Index from "./pages/Index";
const Auth = lazy(() => import("./pages/Auth"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Profile = lazy(() => import("./pages/Profile"));
const Account = lazy(() => import("./pages/Account"));
const Settings = lazy(() => import("./pages/Settings"));
const Help = lazy(() => import("./pages/Help"));
import { PushSync } from "@/components/notifications/PushSync";
import { CallProvider } from "@/contexts/CallContext";
import { PresenceHeartbeat } from "@/components/calls/PresenceHeartbeat";
import { PullToRefresh } from "./components/layout/PullToRefresh";
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const SupportChatRedirect = lazy(() => import("./pages/SupportChatRedirect"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminVendors = lazy(() => import("./pages/admin/Vendors"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminFinance = lazy(() => import("./pages/admin/Finance"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminAnnouncements = lazy(() => import("./pages/admin/Announcements"));
const AdminModeration = lazy(() => import("./pages/admin/Moderation"));
const AdminErrors = lazy(() => import("./pages/admin/Errors"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminLogistics = lazy(() => import("./pages/admin/Logistics"));
const AdminAmbassadors = lazy(() => import("./pages/admin/Ambassadors"));
const AdminPartners = lazy(() => import("./pages/admin/Partners"));
const AdminVendorDetail = lazy(() => import("./pages/admin/VendorDetail"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/CustomerDetail"));
const AdminChatTranscript = lazy(() => import("./pages/admin/ChatTranscript"));
const AdminProductForm = lazy(() => import("./pages/admin/ProductForm"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const VendorDashboard = lazy(() => import("./pages/vendor/Dashboard"));
const VendorMore = lazy(() => import("./pages/vendor/More"));
const VendorProducts = lazy(() => import("./pages/vendor/Products"));
const VendorProductForm = lazy(() => import("./pages/vendor/ProductForm"));
const VendorOrders = lazy(() => import("./pages/vendor/Orders"));
const VendorSettings = lazy(() => import("./pages/vendor/Settings"));
const VendorVerification = lazy(() => import("./pages/vendor/Verification"));
const VendorPromote = lazy(() => import("./pages/vendor/Promote"));
const VendorStories = lazy(() => import("./pages/vendor/Stories"));
const VendorFans = lazy(() => import("./pages/vendor/Fans"));
const VendorReviews = lazy(() => import("./pages/vendor/Reviews"));
const VendorEarnings = lazy(() => import("./pages/vendor/Earnings"));
const StoryViewer = lazy(() => import("./pages/StoryViewer"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const SellerApply = lazy(() => import("./pages/SellerApply"));
const AmbassadorLink = lazy(() => import("./pages/AmbassadorLink"));
const AmbassadorDashboard = lazy(() => import("./pages/AmbassadorDashboard"));
const AmbassadorJoin = lazy(() => import("./pages/AmbassadorJoin"));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));
const SellerLogin = lazy(() => import("./pages/SellerLogin"));
const VendorProfilePage = lazy(() => import("./pages/VendorProfile"));
const Shops = lazy(() => import("./pages/Shops"));
const Messages = lazy(() => import("./pages/Messages"));
const Conversation = lazy(() => import("./pages/Conversation"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Addresses = lazy(() => import("./pages/Addresses"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Thin bar at the top while a page's code downloads (usually a blink, or instant once cached). */
function RouteFallback() {
  return (
    <div className="min-h-[100dvh] bg-background" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-muted">
        <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] bg-primary" />
      </div>
    </div>
  );
}

/** Pages most people open next; fetched quietly once the app is idle so taps feel instant. */
const COMMON_PAGES = [
  () => import("./pages/ProductDetail"),
  () => import("./pages/Products"),
  () => import("./pages/Cart"),
  () => import("./pages/Messages"),
  () => import("./pages/Conversation"),
  () => import("./pages/VendorProfile"),
  () => import("./pages/Orders"),
  () => import("./pages/OrderDetail"),
];
/** Wait this long after start-up before warming pages, so the first screen gets the network to itself. */
const PREFETCH_DELAY_MS = 2500;
if (typeof window !== "undefined") {
  window.setTimeout(() => {
    const warm = () => COMMON_PAGES.forEach((load) => load().catch(() => undefined));
    if ("requestIdleCallback" in window) window.requestIdleCallback(warm);
    else warm();
  }, PREFETCH_DELAY_MS);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Reopening the app shows the last home page instantly while fresh data loads.
persistQueryCache(queryClient);

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CallProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PullToRefresh />
        <PushSync />
        <PresenceHeartbeat />
        <BrowserRouter>
          <AnalyticsTracker />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/account" element={<Account />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/addresses" element={<Addresses />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/vendor/notifications" element={<NotificationsPage area="seller" />} />
            <Route path="/admin/notifications" element={<NotificationsPage area="admin" />} />
            <Route path="/messages/:id" element={<Conversation />} />
            {/* Old link to the support chat */}
            <Route path="/chat" element={<SupportChatRedirect />} />

            {/* Shops & vendors */}
            <Route path="/shops" element={<Shops />} />
            <Route path="/shop/:slug" element={<VendorProfilePage />} />
            <Route path="/vendor/:vendorId" element={<VendorProfilePage />} />
            <Route path="/sell" element={<SellerApply />} />
            <Route path="/r/:code" element={<AmbassadorLink />} />
            <Route path="/ambassador" element={<AmbassadorDashboard />} />
            <Route path="/ambassadors/join" element={<AmbassadorJoin />} />
            <Route path="/partner" element={<PartnerDashboard />} />
            <Route path="/become-vendor" element={<Navigate to="/sell" replace />} />
            <Route path="/vendor/login" element={<SellerLogin />} />
            <Route path="/vendor" element={<Navigate to="/vendor/dashboard" replace />} />
            <Route path="/vendor/dashboard" element={<VendorDashboard />} />
            <Route path="/vendor/messages" element={<Messages seller />} />
            <Route path="/vendor/messages/:id" element={<Conversation seller />} />
            <Route path="/vendor/more" element={<VendorMore />} />
            <Route path="/vendor/products" element={<VendorProducts />} />
            <Route path="/vendor/products/new" element={<VendorProductForm />} />
            <Route path="/vendor/products/:id" element={<VendorProductForm />} />
            <Route path="/vendor/orders" element={<VendorOrders />} />
            <Route path="/vendor/settings" element={<VendorSettings />} />
            <Route path="/vendor/verification" element={<VendorVerification />} />
            <Route path="/vendor/promote" element={<VendorPromote />} />
            <Route path="/vendor/stories" element={<VendorStories />} />
            <Route path="/vendor/fans" element={<VendorFans />} />
            <Route path="/vendor/reviews" element={<VendorReviews />} />
            <Route path="/vendor/earnings" element={<VendorEarnings />} />
            <Route path="/stories/:vendorId" element={<StoryViewer />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/vendors" element={<AdminVendors />} />
            <Route path="/admin/vendors/:id" element={<AdminVendorDetail />} />
            <Route path="/admin/users/:id" element={<AdminCustomerDetail />} />
            <Route path="/admin/chats/:id" element={<AdminChatTranscript />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/products/new" element={<AdminProductForm />} />
            <Route path="/admin/products/:id/edit" element={<AdminProductForm />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/logistics" element={<AdminLogistics />} />
            <Route path="/admin/ambassadors" element={<AdminAmbassadors />} />
            <Route path="/admin/partners" element={<AdminPartners />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/moderation" element={<AdminModeration />} />
            <Route path="/admin/errors" element={<AdminErrors />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/chats" element={<Navigate to="/admin/messages" replace />} />
            <Route path="/admin/messages" element={<Messages admin />} />
            <Route path="/admin/messages/:id" element={<Conversation admin />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <Analytics />
        </BrowserRouter>
      </TooltipProvider>
      </CallProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
