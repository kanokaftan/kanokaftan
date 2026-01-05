import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
  image: string | null;
}

interface TopVendor {
  id: string;
  storeName: string;
  totalSales: number;
  orderCount: number;
  avatar: string | null;
}

interface CategoryBreakdown {
  name: string;
  count: number;
  percentage: number;
}

interface AnalyticsData {
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  topVendors: TopVendor[];
  categoryBreakdown: CategoryBreakdown[];
  revenueGrowth: number;
  orderGrowth: number;
  userGrowth: number;
  averageOrderValue: number;
  conversionRate: number;
  totalRevenueThisMonth: number;
  totalRevenueLastMonth: number;
  totalOrdersThisMonth: number;
  totalOrdersLastMonth: number;
  newUsersThisMonth: number;
  newUsersLastMonth: number;
}

export function useAdminAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: async (): Promise<AnalyticsData> => {
      const today = new Date();
      const startDate = subDays(today, days);
      const thisMonthStart = startOfMonth(today);
      const lastMonthStart = startOfMonth(subDays(thisMonthStart, 1));
      const lastMonthEnd = endOfMonth(subDays(thisMonthStart, 1));

      // Fetch orders for the period
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, created_at, payment_status, user_id")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      // Fetch order items with product info
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          id, product_id, product_name, quantity, total_price, vendor_id,
          order:orders!inner(created_at, payment_status)
        `)
        .gte("order.created_at", startDate.toISOString());

      // Fetch products for images
      const { data: products } = await supabase
        .from("products")
        .select("id, name, category_id, product_images(url)");

      // Fetch categories
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name");

      // Fetch vendor profiles
      const { data: vendorProfiles } = await supabase
        .from("profiles")
        .select("id, store_name, avatar_url");

      // Fetch user signups
      const { data: users } = await supabase
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", lastMonthStart.toISOString());

      // Calculate daily revenue
      const dailyRevenueMap = new Map<string, { revenue: number; orders: number }>();
      const dateRange = eachDayOfInterval({ start: startDate, end: today });
      
      dateRange.forEach(date => {
        dailyRevenueMap.set(format(date, "yyyy-MM-dd"), { revenue: 0, orders: 0 });
      });

      orders?.filter(o => o.payment_status === "paid").forEach(order => {
        const dateKey = format(new Date(order.created_at), "yyyy-MM-dd");
        const existing = dailyRevenueMap.get(dateKey) || { revenue: 0, orders: 0 };
        dailyRevenueMap.set(dateKey, {
          revenue: existing.revenue + Number(order.total),
          orders: existing.orders + 1,
        });
      });

      const dailyRevenue: DailyRevenue[] = Array.from(dailyRevenueMap.entries()).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        orders: data.orders,
      }));

      // Calculate top products (only from paid orders)
      const productSalesMap = new Map<string, { name: string; totalSold: number; revenue: number; image: string | null }>();
      
      // Filter to only paid order items
      const paidOrderItems = orderItems?.filter(item => (item.order as any)?.payment_status === "paid") || [];
      
      paidOrderItems.forEach(item => {
        const existing = productSalesMap.get(item.product_id) || { 
          name: item.product_name, 
          totalSold: 0, 
          revenue: 0,
          image: null 
        };
        const product = products?.find(p => p.id === item.product_id);
        productSalesMap.set(item.product_id, {
          name: item.product_name,
          totalSold: existing.totalSold + item.quantity,
          revenue: existing.revenue + Number(item.total_price),
          image: product?.product_images?.[0]?.url || null,
        });
      });

      const topProducts: TopProduct[] = Array.from(productSalesMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate top vendors (only from paid orders)
      const vendorSalesMap = new Map<string, { storeName: string; totalSales: number; orderCount: number; avatar: string | null }>();
      
      paidOrderItems.forEach(item => {
        const vendor = vendorProfiles?.find(v => v.id === item.vendor_id);
        const existing = vendorSalesMap.get(item.vendor_id) || { 
          storeName: vendor?.store_name || "Unknown Store", 
          totalSales: 0, 
          orderCount: 0,
          avatar: vendor?.avatar_url || null 
        };
        vendorSalesMap.set(item.vendor_id, {
          ...existing,
          totalSales: existing.totalSales + Number(item.total_price),
          orderCount: existing.orderCount + 1,
        });
      });

      const topVendors: TopVendor[] = Array.from(vendorSalesMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 10);

      // Category breakdown
      const categoryCountMap = new Map<string, number>();
      products?.forEach(product => {
        if (product.category_id) {
          const category = categories?.find(c => c.id === product.category_id);
          const categoryName = category?.name || "Uncategorized";
          categoryCountMap.set(categoryName, (categoryCountMap.get(categoryName) || 0) + 1);
        }
      });

      const totalProducts = products?.length || 1;
      const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryCountMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalProducts) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate growth metrics
      const thisMonthOrders = orders?.filter(o => 
        new Date(o.created_at) >= thisMonthStart && o.payment_status === "paid"
      ) || [];
      const lastMonthOrders = orders?.filter(o => 
        new Date(o.created_at) >= lastMonthStart && 
        new Date(o.created_at) <= lastMonthEnd && 
        o.payment_status === "paid"
      ) || [];

      const totalRevenueThisMonth = thisMonthOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalRevenueLastMonth = lastMonthOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrdersThisMonth = thisMonthOrders.length;
      const totalOrdersLastMonth = lastMonthOrders.length;

      const thisMonthUsers = users?.filter(u => new Date(u.created_at) >= thisMonthStart) || [];
      const lastMonthUsers = users?.filter(u => 
        new Date(u.created_at) >= lastMonthStart && new Date(u.created_at) <= lastMonthEnd
      ) || [];

      const newUsersThisMonth = thisMonthUsers.length;
      const newUsersLastMonth = lastMonthUsers.length;

      const revenueGrowth = totalRevenueLastMonth > 0 
        ? ((totalRevenueThisMonth - totalRevenueLastMonth) / totalRevenueLastMonth) * 100 
        : 0;
      const orderGrowth = totalOrdersLastMonth > 0 
        ? ((totalOrdersThisMonth - totalOrdersLastMonth) / totalOrdersLastMonth) * 100 
        : 0;
      const userGrowth = newUsersLastMonth > 0 
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 
        : 0;

      const averageOrderValue = totalOrdersThisMonth > 0 
        ? totalRevenueThisMonth / totalOrdersThisMonth 
        : 0;

      // Rough conversion rate (orders / unique users this month)
      const uniqueBuyers = new Set(thisMonthOrders.map(o => o.user_id)).size;
      const totalUsersCount = users?.length || 1;
      const conversionRate = (uniqueBuyers / totalUsersCount) * 100;

      return {
        dailyRevenue,
        topProducts,
        topVendors,
        categoryBreakdown,
        revenueGrowth,
        orderGrowth,
        userGrowth,
        averageOrderValue,
        conversionRate,
        totalRevenueThisMonth,
        totalRevenueLastMonth,
        totalOrdersThisMonth,
        totalOrdersLastMonth,
        newUsersThisMonth,
        newUsersLastMonth,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
