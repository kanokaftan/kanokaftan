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
import Auth from "./pages/Auth";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Wishlist from "./pages/Wishlist";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import { PushSync } from "@/components/notifications/PushSync";
import { CallProvider } from "@/contexts/CallContext";
import { PresenceHeartbeat } from "@/components/calls/PresenceHeartbeat";
import { PullToRefresh } from "./components/layout/PullToRefresh";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import SupportChatRedirect from "./pages/SupportChatRedirect";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminVendors from "./pages/admin/Vendors";
import AdminProducts from "./pages/admin/Products";
import AdminOrders from "./pages/admin/Orders";
import AdminCategories from "./pages/admin/Categories";
import AdminFinance from "./pages/admin/Finance";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminModeration from "./pages/admin/Moderation";
import AdminErrors from "./pages/admin/Errors";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminLogistics from "./pages/admin/Logistics";
import AdminVendorDetail from "./pages/admin/VendorDetail";
import AdminCustomerDetail from "./pages/admin/CustomerDetail";
import AdminChatTranscript from "./pages/admin/ChatTranscript";
import AdminProductForm from "./pages/admin/ProductForm";
import AdminLogin from "./pages/admin/AdminLogin";
import VendorDashboard from "./pages/vendor/Dashboard";
import VendorMore from "./pages/vendor/More";
import VendorProducts from "./pages/vendor/Products";
import VendorProductForm from "./pages/vendor/ProductForm";
import VendorOrders from "./pages/vendor/Orders";
import VendorSettings from "./pages/vendor/Settings";
import VendorVerification from "./pages/vendor/Verification";
import VendorPromote from "./pages/vendor/Promote";
import VendorStories from "./pages/vendor/Stories";
import VendorFans from "./pages/vendor/Fans";
import VendorReviews from "./pages/vendor/Reviews";
import VendorEarnings from "./pages/vendor/Earnings";
import StoryViewer from "./pages/StoryViewer";
import NotificationsPage from "./pages/Notifications";
import SellerApply from "./pages/SellerApply";
import SellerLogin from "./pages/SellerLogin";
import VendorProfilePage from "./pages/VendorProfile";
import Shops from "./pages/Shops";
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Addresses from "./pages/Addresses";
import NotFound from "./pages/NotFound";

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
          <Analytics />
        </BrowserRouter>
      </TooltipProvider>
      </CallProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
