import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminConversations } from "@/hooks/useAdminOversight";
import { withoutLeadingEmoji } from "@/lib/text";

/**
 * A seller's chats with customers (or a customer's chats with sellers), WhatsApp-style.
 * Tapping one opens it read-only.
 */
export function AdminChatList({ vendorId, customerId }: { vendorId?: string; customerId?: string }) {
  const { data: chats = [], isLoading, error } = useAdminConversations({ vendorId, customerId });
  // On a seller's page show the customer; on a customer's page show the seller.
  const showCustomer = !!vendorId;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    );
  }
  if (error) return <p className="py-6 text-center text-sm text-destructive">{(error as Error).message}</p>;
  if (chats.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
        No chats yet
      </div>
    );
  }

  return (
    <ul className="-mx-1">
      {chats.map((chat) => {
        const name = showCustomer ? chat.customer_name : chat.vendor_name;
        const avatar = showCustomer ? chat.customer_avatar : chat.vendor_avatar;
        const fromOther = chat.last_sender_id === (showCustomer ? chat.customer_id : chat.vendor_id);
        return (
          <li key={chat.id}>
            <Link
              to={`/admin/chats/${chat.id}`}
              className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-muted/60 active:bg-muted"
            >
              <Avatar className="h-11 w-11">
                <AvatarImage src={avatar || undefined} />
                <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 border-b border-border/60 pb-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{name}</p>
                  {chat.last_message_at && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(chat.last_message_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {!fromOther && chat.last_sender_id ? <span className="font-medium">{showCustomer ? "Seller: " : "Customer: "}</span> : null}
                  {withoutLeadingEmoji(chat.last_message_preview) || "…"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {chat.message_count} messages{chat.product_name ? ` · about ${chat.product_name}` : ""}
                  {chat.kind === "support" ? " · support chat" : ""}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
