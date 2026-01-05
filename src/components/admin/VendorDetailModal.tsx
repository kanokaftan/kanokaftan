import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  BadgeCheck, 
  Store, 
  Mail, 
  Phone, 
  MapPin, 
  Package, 
  Calendar,
  Wallet,
  Building2,
  CreditCard,
  User,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface VendorDetailProps {
  vendor: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    store_name: string | null;
    store_description: string | null;
    created_at: string;
    product_count: number;
    bank_name?: string | null;
    account_number?: string | null;
    account_name?: string | null;
    payout_preference?: string | null;
    store_address?: {
      street?: string;
      city?: string;
      state?: string;
    } | null;
    total_sales?: number;
    pending_payout?: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify?: (vendorId: string, isVerified: boolean) => void;
}

export function VendorDetailModal({ vendor, open, onOpenChange, onVerify }: VendorDetailProps) {
  if (!vendor) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const storeAddress = vendor.store_address as { street?: string; city?: string; state?: string } | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vendor Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vendor Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={vendor.avatar_url || undefined} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {vendor.store_name?.charAt(0) || vendor.full_name?.charAt(0) || "V"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg">{vendor.store_name || "No Store Name"}</h3>
                {vendor.is_verified && (
                  <Badge className="bg-green-100 text-green-800 gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{vendor.full_name || "No name set"}</p>
              {vendor.store_description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {vendor.store_description}
                </p>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 text-center">
                <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{vendor.product_count}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
              <CardContent className="pt-4 text-center">
                <Wallet className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold text-green-600">
                  {vendor.total_sales ? formatCurrency(vendor.total_sales) : "₦0"}
                </p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
              <CardContent className="pt-4 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className="text-2xl font-bold text-amber-600">
                  {vendor.pending_payout ? formatCurrency(vendor.pending_payout) : "₦0"}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{vendor.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{vendor.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Joined {format(new Date(vendor.created_at), "MMMM dd, yyyy")}
                </span>
              </div>
              {storeAddress && (storeAddress.street || storeAddress.city || storeAddress.state) && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">
                    {[storeAddress.street, storeAddress.city, storeAddress.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payout Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payout Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{vendor.bank_name || "No bank set"}</p>
                  <p className="text-xs text-muted-foreground">Bank Name</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{vendor.account_number || "Not provided"}</p>
                  <p className="text-xs text-muted-foreground">Account Number</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{vendor.account_name || "Not provided"}</p>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium capitalize">{vendor.payout_preference || "Weekly"}</p>
                  <p className="text-xs text-muted-foreground">Payout Preference</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {onVerify && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant={vendor.is_verified ? "outline" : "default"}
                onClick={() => onVerify(vendor.id, vendor.is_verified)}
              >
                {vendor.is_verified ? "Revoke Verification" : "Verify Vendor"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}