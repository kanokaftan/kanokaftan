import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, CreditCard, User, ChevronRight, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface PendingOrder {
  id: string;
  total: number;
  created_at: string;
  customer: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  items_count: number;
}

export function PendingPaymentsSection() {
  const navigate = useNavigate();

  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: ["admin-pending-payments"],
    queryFn: async (): Promise<PendingOrder[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          id,
          total,
          created_at,
          user_id,
          order_items(id)
        `)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch customer profiles
      const userIds = [...new Set(orders?.map(o => o.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      return orders?.map(order => ({
        id: order.id,
        total: Number(order.total),
        created_at: order.created_at,
        customer: profileMap.get(order.user_id) || null,
        items_count: order.order_items?.length || 0,
      })) || [];
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            Pending Payments
          </CardTitle>
          {pendingOrders && pendingOrders.length > 0 && (
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              {pendingOrders.length} awaiting
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!pendingOrders || pendingOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No pending payments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                onClick={() => navigate(`/admin/orders?id=${order.id}`)}
              >
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={order.customer?.avatar_url || undefined} />
                  <AvatarFallback>
                    {order.customer?.full_name?.charAt(0) || order.customer?.email?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {order.customer?.full_name || order.customer?.email || "Unknown Customer"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{order.items_count} item{order.items_count !== 1 ? "s" : ""}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-600">{formatCurrency(order.total)}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            
            <Button 
              variant="ghost" 
              className="w-full text-sm"
              onClick={() => navigate("/admin/orders?status=pending")}
            >
              View All Pending Orders
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}