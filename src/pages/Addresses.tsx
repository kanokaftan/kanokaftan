import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Pencil, Trash2, Check, ChevronLeft } from "lucide-react";
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

export default function Addresses() {
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
      <div className="px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">Delivery Addresses</h1>
            <p className="text-sm text-muted-foreground">Manage your saved addresses</p>
          </div>
        </div>

        {/* Add Address Button */}
        <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full mb-6 gap-2">
              <Plus className="h-4 w-4" />
              Add New Address
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add New Address</SheetTitle>
            </SheetHeader>
            <AddressForm onSuccess={() => setIsAddSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Addresses List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">No addresses yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first delivery address to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <Card key={address.id} className={address.is_default ? "border-primary" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{address.label}</span>
                      {address.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Sheet open={editingAddress === address.id} onOpenChange={(open) => setEditingAddress(open ? address.id : null)}>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Address?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{address.label}" from your saved addresses.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(address.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  <p className="text-sm font-medium">{address.full_name}</p>
                  <p className="text-sm text-muted-foreground">{address.phone}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {address.street_address}, {address.city}, {address.state}
                  </p>
                  {address.landmark && (
                    <p className="text-sm text-muted-foreground">Near: {address.landmark}</p>
                  )}

                  {!address.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full gap-2"
                      onClick={() => handleSetDefault(address.id)}
                      disabled={setDefaultAddress.isPending}
                    >
                      <Check className="h-4 w-4" />
                      Set as Default
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