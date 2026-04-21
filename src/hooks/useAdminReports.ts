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
  }[];
  categoryReport: {
    id: string;
    name: string;
    totalProducts: number;
    totalSold: number;
    revenue: number;
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

      const [ordersRes, orderItemsRes, productsRes, profilesRes, categoriesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, created_at, payment_status, customer_id")
          .gte("created_at", sixtyDaysAgo.toISOString()),
        supabase
          .from("order_items")
          .select("product_id, product_name, quantity, total_price, order:orders!inner(created_at, payment_status)"),
        supabase
          .from("products")
          .select("id, name, category_id, stock_quantity"),
        supabase
          .from("profiles")
          .select("id, full_name, created_at"),
        supabase
          .from("categories")
          .select("id, name"),
      ]);

      const orders = ordersRes.data || [];
      const orderItems = orderItemsRes.data || [];
      const products = productsRes.data || [];
      const profiles = profilesRes.data || [];
      const categories = categoriesRes.data || [];

      // Sales Report — weekly breakdown
      const weeks = eachWeekOfInterval({ start: sixtyDaysAgo, end: today });
      const salesReport = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        const weekOrders = orders.filter(o => {
          const d = new Date(o.created_at);
          return d >= weekStart && d <= weekEnd && o.payment_status === "paid";
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
        return {
          id: product.id,
          name: product.name,
          category: category?.name || "Uncategorized",
          totalSold: sales.sold,
          revenue: sales.revenue,
          stockRemaining: product.stock_quantity,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // Category Report
      const categorySalesMap = new Map<string, { sold: number; revenue: number }>();
      products.forEach(product => {
        const sales = productSalesMap.get(product.id) || { sold: 0, revenue: 0 };
        const catId = product.category_id || "uncategorized";
        const existing = categorySalesMap.get(catId) || { sold: 0, revenue: 0 };
        categorySalesMap.set(catId, {
          sold: existing.sold + sales.sold,
          revenue: existing.revenue + sales.revenue,
        });
      });

      const productCountByCategory = new Map<string, number>();
      products.forEach(p => {
        const catId = p.category_id || "uncategorized";
        productCountByCategory.set(catId, (productCountByCategory.get(catId) || 0) + 1);
      });

      const categoryReport = [
        ...categories.map(cat => {
          const sales = categorySalesMap.get(cat.id) || { sold: 0, revenue: 0 };
          return {
            id: cat.id,
            name: cat.name,
            totalProducts: productCountByCategory.get(cat.id) || 0,
            totalSold: sales.sold,
            revenue: sales.revenue,
          };
        }),
        ...(categorySalesMap.has("uncategorized") ? [{
          id: "uncategorized",
          name: "Uncategorized",
          totalProducts: productCountByCategory.get("uncategorized") || 0,
          totalSold: categorySalesMap.get("uncategorized")!.sold,
          revenue: categorySalesMap.get("uncategorized")!.revenue,
        }] : []),
      ].sort((a, b) => b.revenue - a.revenue);

      // User Report — weekly breakdown
      const userReport = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        const weekUsers = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d >= weekStart && d <= weekEnd;
        });
        const weekOrders = orders.filter(o => {
          const d = new Date(o.created_at);
          return d >= weekStart && d <= weekEnd;
        });
        const activeUsers = new Set(weekOrders.map(o => o.customer_id)).size;
        return {
          period: format(weekStart, "MMM dd"),
          newUsers: weekUsers.length,
          activeUsers,
          totalOrders: weekOrders.length,
        };
      });

      return { salesReport, productReport, categoryReport, userReport };
    },
    staleTime: 1000 * 60 * 10,
  });
}
