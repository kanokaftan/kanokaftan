import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Pencil, Trash2, Check, ChevronLeft, Home } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAddresses, type AddressFormData } from "@/hooks/useAddresses";
import { AddressForm } from "@/components/checkout/AddressForm";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Addresses() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { addresses, isLoading, setDefaultAddress, deleteAddress } = useAddresses();
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);

  if (!authLoading && !user) {
    navigate("/auth?redirect=/addresses");
    return null;
  }

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress.mutateAsync(id);
      toast.success("Default address updated");
    } catch {
      toast.error("Failed to update default address");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAddress.mutateAsync(id);
      toast.success("Address deleted");
    } catch {
      toast.error("Failed to delete address");
    }
  };

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">{t("addresses.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("addresses.emptyDesc")}</p>
          </div>
        </div>

        {/* Add Address Button */}
        <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full mb-6 gap-2">
              <Plus className="h-4 w-4" />
              {t("addresses.add")}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("addresses.add")}</SheetTitle>
            </SheetHeader>
            <AddressForm onSuccess={() => setIsAddSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Addresses List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold mb-1">{t("addresses.empty")}</h3>
              <p className="text-sm text-muted-foreground">{t("addresses.emptyDesc")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <Card
                key={address.id}
                className={address.is_default ? "border-primary shadow-sm" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Home className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-sm">{address.label}</span>
                        {address.is_default && (
                          <Badge className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                            {t("addresses.default")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Sheet
                        open={editingAddress === address.id}
                        onOpenChange={(open) => setEditingAddress(open ? address.id : null)}
                      >
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Edit Address</SheetTitle>
                          </SheetHeader>
                          <AddressForm
                            editAddress={address}
                            onSuccess={() => setEditingAddress(null)}
                          />
                        </SheetContent>
                      </Sheet>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("addresses.delete")} Address?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove "{address.label}" from your saved addresses.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(address.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("addresses.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="space-y-0.5 pl-10">
                    <p className="text-sm font-medium">{address.full_name}</p>
                    <p className="text-sm text-muted-foreground">{address.phone}</p>
                    <p className="text-sm text-muted-foreground">
                      {address.street_address}, {address.city}, {address.state}
                    </p>
                    {address.landmark && (
                      <p className="text-xs text-muted-foreground">📍 {address.landmark}</p>
                    )}
                  </div>

                  {!address.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 ml-10 gap-2 text-xs"
                      onClick={() => handleSetDefault(address.id)}
                      disabled={setDefaultAddress.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("addresses.setDefault")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
