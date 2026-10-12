import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useChat";
import { ChatWithUsButton } from "@/components/chat/ChatWithUsButton";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallHistory } from "@/components/calls/CallHistory";
import { isMissedForMe, useCallHistory } from "@/hooks/useCallHistory";
import { withoutLeadingEmoji } from "@/lib/text";

/** Chats a seller handles from the seller area: their customers, and Kano Kaftan support. */
const SELLER_ROLES = new Set(["vendor", "support_user"]);

/**
 * Inbox. With `admin`, it renders inside the admin dashboard and opens chats there;
 * with `seller`, inside the seller area with only the shop's customer chats.
 */
export default function Messages({ admin = false, seller = false }: { admin?: boolean; seller?: boolean }) {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { conversations: allConversations, isLoading } = useConversations();
  const conversations = seller ? allConversations.filter((c) => SELLER_ROLES.has(c.role)) : allConversations;
  const basePath = admin ? "/admin/messages" : seller ? "/vendor/messages" : "/messages";
  const inDashboard = admin || seller;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "calls" ? "calls" : "chats";
  const { data: calls = [] } = useCallHistory();
  // Missed calls since the newest call you made or answered.
  const recentMissed = calls.findIndex((c) => !isMissedForMe(c));
  const missedCount = (recentMissed === -1 ? calls : calls.slice(0, recentMissed)).filter(isMissedForMe).length;
  const changeTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "calls") params.set("tab", "calls");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?redirect=${basePath}`);
  }, [authLoading, user, navigate, basePath]);

  // Admins answer customers from the dashboard, not the shop's inbox.
  useEffect(() => {
    if (!inDashboard && !authLoading && isAdmin) navigate("/admin/messages", { replace: true });
  }, [inDashboard, authLoading, isAdmin, navigate]);

  const inbox = (
      <div className={inDashboard ? "" : "px-4 py-6 pb-24"}>
        {seller && (
          <div className="mb-3 flex justify-end">
            <ChatWithUsButton size="sm" variant="outline" className="rounded-full" label="Chat with Kano Kaftan" chatBasePath="/vendor/messages" />
          </div>
        )}
        {!inDashboard && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <h1 className="font-display text-xl font-bold">Messages</h1>
            {!isAdmin && <ChatWithUsButton size="sm" variant="outline" label="Chat with us" />}
          </div>
        )}

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="calls" className="gap-1.5">
              Calls
              {missedCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white">{missedCount}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calls">
            <CallHistory basePath={basePath} />
          </TabsContent>
          <TabsContent value="chats">
        {isLoading || authLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <MessageCircle className="mb-3 h-12 w-12 opacity-50" />
            <p>No messages yet.</p>
            {admin ? (
              <p className="text-sm">When customers or sellers tap "Chat with us", their conversations appear here.</p>
            ) : seller ? (
              <p className="text-sm">When customers tap "Chat with seller" on your shop or products, their messages appear here.</p>
            ) : (
              <>
                <p className="text-sm">Questions, or want us to buy something for you? Chat with the Kano Kaftan team.</p>
                <ChatWithUsButton className="mt-4" label="Chat with Kano Kaftan" />
                <Button asChild variant="outline" className="mt-2">
                  <Link to="/shops">Browse shops</Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          // WhatsApp-style list: no box, just a thin line under each row that starts after the picture.
          <ul className={cn(!admin && "-mx-4")}>
            {conversations.map((c) => (
              <li key={c.id} className="group">
                <Link
                  to={`${basePath}/${c.id}`}
                  className="flex items-center gap-3 pl-4 transition-colors active:bg-muted/70 hover:bg-muted/40"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={c.other_party_avatar || undefined} alt="" />
                    <AvatarFallback>{c.other_party_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 border-b border-border/60 py-3 pr-4 group-last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-[15px]", c.unread ? "font-semibold" : "font-medium")}>
                        {c.other_party_name}
                        {c.role === "vendor" && <span className="ml-1 text-xs font-normal text-muted-foreground">(customer)</span>}
                        {c.role === "support_team" && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (support · {c.other_party_is_vendor ? "vendor" : "customer"})
                          </span>
                        )}
                      </p>
                      {c.last_message_at && (
                        <span className={cn("flex-shrink-0 text-xs", c.unread ? "font-semibold text-primary" : "text-muted-foreground")}>
                          {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn("truncate text-sm", c.unread ? "text-foreground" : "text-muted-foreground")}>
                        {withoutLeadingEmoji(c.last_message_preview)}
                      </p>
                      {c.unread && <span className="ml-auto h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
          </TabsContent>
        </Tabs>
      </div>
  );

  if (admin) return <AdminLayout title="Messages">{inbox}</AdminLayout>;
  if (seller) return <VendorLayout title="Chats">{inbox}</VendorLayout>;
  return <MobileLayout>{inbox}</MobileLayout>;
}
