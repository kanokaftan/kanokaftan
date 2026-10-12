import { Link, useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Calendar, ChevronLeft, Heart, Mail, MessageCircle, Phone, ShoppingBag, Star, Store, Wallet } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminChatList } from "@/components/admin/oversight/AdminChatList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerOverview, usePersonProfile } from "@/hooks/useAdminOversight";
import { cn } from "@/lib/utils";

const naira = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
const human = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** One customer: contact, spending, recent orders and their chats with sellers. */
export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: profile, isLoading } = usePersonProfile(id);
  const { data: o, error } = useCustomerOverview(id);
  const name = profile?.full_name || profile?.email || "Customer";

  const stats = o
    ? [
        { icon: Wallet, label: "Spent (paid)", value: naira(o.total_spent) },
        { icon: ShoppingBag, label: "Orders", value: `${o.paid_orders} paid`, sub: `${o.orders} placed` },
        { icon: MessageCircle, label: "Chats", value: String(o.chats) },
        { icon: Heart, label: "Favourites", value: String(o.wishlist) },
        { icon: Store, label: "Shops followed", value: String(o.following) },
        { icon: Star, label: "Reviews", value: String(o.reviews) },
      ]
    : [];

  return (
    <AdminLayout title="Customer">
      <div className="mx-auto max-w-3xl space-y-4 pb-20 md:pb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 shrink-0 rounded-full" onClick={() => navigate("/admin/users")} aria-label="Back to customers">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-12 flex-1 rounded-xl" />
          ) : !profile ? (
            <p className="text-sm text-muted-foreground">Customer not found</p>
          ) : (
            <>
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{name}</h2>
                <p className="truncate text-xs text-muted-foreground">Customer since {format(new Date(profile.created_at), "d MMM yyyy")}</p>
              </div>
            </>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {o ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border bg-card p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><s.icon className="h-3.5 w-3.5" aria-hidden="true" />{s.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
                {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
              </div>
            ))}
          </div>
        ) : !error && <Skeleton className="h-40 rounded-2xl" />}

        {profile && (
          <Card>
            <CardContent className="p-4 text-sm">
              <p className="mb-1 font-semibold">Contact</p>
              <p className="flex items-center gap-3 border-b border-border/60 py-2.5"><Mail className="h-4 w-4 text-muted-foreground" /><a href={`mailto:${profile.email}`} className="hover:underline">{profile.email}</a></p>
              <p className="flex items-center gap-3 border-b border-border/60 py-2.5"><Phone className="h-4 w-4 text-muted-foreground" />{profile.phone ? <a href={`tel:${profile.phone}`} className="hover:underline">{profile.phone}</a> : "No phone number"}</p>
              <p className="flex items-center gap-3 py-2.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {o?.last_order_at ? `Last order ${formatDistanceToNowStrict(new Date(o.last_order_at), { addSuffix: true })}` : "No orders yet"}
                {o && o.open_disputes > 0 && <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{o.open_disputes} open dispute</span>}
              </p>
            </CardContent>
          </Card>
        )}

        {o && o.recent_orders.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-sm font-semibold">Recent orders</p>
              <ul className="divide-y">
                {o.recent_orders.map((order) => (
                  <li key={order.id}>
                    <Link to={`/admin/orders?search=${order.id.slice(0, 8)}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/40">
                      <span>
                        <span className="font-medium">#{order.id.slice(0, 8)}</span>
                        <span className="block text-xs text-muted-foreground">{format(new Date(order.created_at), "d MMM yyyy, HH:mm")}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">{naira(Number(order.total))}</span>
                        <span className={cn("text-[11px]", order.payment_status === "paid" ? "text-foreground" : "text-muted-foreground")}>
                          {human(order.payment_status)} · {human(order.status)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {id && (
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-sm font-semibold">Chats with sellers</p>
              <AdminChatList customerId={id} />
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
