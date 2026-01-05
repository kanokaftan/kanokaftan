import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";

interface ReportData {
  salesReport: {
    period: string;
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
  }[];
  productReport: {
    id: string;
    name: string;
    category: string;
    totalSold: number;
    revenue: number;
    stockRemaining: number;
    vendor: string;
  }[];
  vendorReport: {
    id: string;
    name: string;
    storeName: string;
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    isVerified: boolean;
    joinedDate: string;
  }[];
  userReport: {
    period: string;
    newUsers: number;
    activeUsers: number;
    totalOrders: number;
  }[];
}

export function useAdminReports() {
  return useQuery({
    queryKey: ["admin-reports"],
    queryFn: async (): Promise<ReportData> => {
      const today = new Date();
      const sixtyDaysAgo = subDays(today, 60);

      // Fetch all needed data
      const [ordersRes, orderItemsRes, productsRes, profilesRes, vendorRolesRes, categoriesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, created_at, payment_status, user_id")
          .gte("created_at", sixtyDaysAgo.toISOString()),
        supabase
          .from("order_items")
          .select("product_id, product_name, vendor_id, quantity, total_price, order:orders!inner(created_at, payment_status)"),
        supabase
          .from("products")
          .select("id, name, category_id, vendor_id, stock_quantity"),
        supabase
          .from("profiles")
          .select("id, full_name, store_name, is_verified, created_at"),
        supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "vendor"),
        supabase
          .from("categories")
          .select("id, name"),
      ]);

      const orders = ordersRes.data || [];
      const orderItems = orderItemsRes.data || [];
      const products = productsRes.data || [];
      const profiles = profilesRes.data || [];
      const vendorRoles = vendorRolesRes.data || [];
      const categories = categoriesRes.data || [];

      const vendorIds = new Set(vendorRoles.map(r => r.user_id));

      // Sales Report - Weekly breakdown
      const weeks = eachWeekOfInterval({ start: sixtyDaysAgo, end: today });
      const salesReport = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        const weekOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= weekStart && orderDate <= weekEnd && o.payment_status === "paid";
        });

        const totalRevenue = weekOrders.reduce((sum, o) => sum + Number(o.total), 0);
        const totalOrders = weekOrders.length;

        return {
          period: `${format(weekStart, "MMM dd")} - ${format(weekEnd, "MMM dd")}`,
          totalRevenue,
          totalOrders,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        };
      });

      // Product Report
      const productSalesMap = new Map<string, { sold: number; revenue: number }>();
      orderItems.forEach((item: any) => {
        if (item.order?.payment_status === "paid") {
          const existing = productSalesMap.get(item.product_id) || { sold: 0, revenue: 0 };
          productSalesMap.set(item.product_id, {
            sold: existing.sold + item.quantity,
            revenue: existing.revenue + Number(item.total_price),
          });
        }
      });

      const productReport = products.map(product => {
        const sales = productSalesMap.get(product.id) || { sold: 0, revenue: 0 };
        const category = categories.find(c => c.id === product.category_id);
        const vendor = profiles.find(p => p.id === product.vendor_id);

        return {
          id: product.id,
          name: product.name,
          category: category?.name || "Uncategorized",
          totalSold: sales.sold,
          revenue: sales.revenue,
          stockRemaining: product.stock_quantity,
          vendor: vendor?.store_name || vendor?.full_name || "Unknown",
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // Vendor Report
      const vendorOrdersMap = new Map<string, { orders: number; revenue: number }>();
      orderItems.forEach((item: any) => {
        if (item.order?.payment_status === "paid") {
          const existing = vendorOrdersMap.get(item.vendor_id) || { orders: 0, revenue: 0 };
          vendorOrdersMap.set(item.vendor_id, {
            orders: existing.orders + 1,
            revenue: existing.revenue + Number(item.total_price),
          });
        }
      });

      const vendorProductCount = new Map<string, number>();
      products.forEach(p => {
        vendorProductCount.set(p.vendor_id, (vendorProductCount.get(p.vendor_id) || 0) + 1);
      });

      const vendorReport = profiles
        .filter(p => vendorIds.has(p.id))
        .map(vendor => {
          const sales = vendorOrdersMap.get(vendor.id) || { orders: 0, revenue: 0 };
          return {
            id: vendor.id,
            name: vendor.full_name || "Unknown",
            storeName: vendor.store_name || "No Store Name",
            totalProducts: vendorProductCount.get(vendor.id) || 0,
            totalOrders: sales.orders,
            totalRevenue: sales.revenue,
            isVerified: vendor.is_verified,
            joinedDate: vendor.created_at,
          };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // User Report - Weekly breakdown
      const userReport = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        const weekUsers = profiles.filter(p => {
          const createdDate = new Date(p.created_at);
          return createdDate >= weekStart && createdDate <= weekEnd;
        });

        const weekOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= weekStart && orderDate <= weekEnd;
        });

        const activeUsers = new Set(weekOrders.map(o => o.user_id)).size;

        return {
          period: `${format(weekStart, "MMM dd")}`,
          newUsers: weekUsers.length,
          activeUsers,
          totalOrders: weekOrders.length,
        };
      });

      return {
        salesReport,
        productReport,
        vendorReport,
        userReport,
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
