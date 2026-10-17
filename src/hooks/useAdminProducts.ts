import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { removeProduct } from "@/lib/removeProduct";
import {
  ADMIN_LIST_STALE_TIME_MS,
  adminRpcError,
  bool,
  num,
  pagingArgs,
  parseAdminListResult,
  recordList,
  recordOrNull,
  resolveListParams,
  str,
  strOrNull,
  type AdminListPage,
  type AdminListParams,
  type ResolvedListParams,
} from "@/hooks/adminList";

const RPC = "admin_list_products";
const LIST_KEY = ["admin-products", "list"] as const;

export const ADMIN_PRODUCT_FILTERS = ["all", "active", "inactive", "featured", "out_of_stock"] as const;
export type AdminProductFilter = (typeof ADMIN_PRODUCT_FILTERS)[number];
export const DEFAULT_PRODUCT_FILTER: AdminProductFilter = "all";

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  featured: boolean;
  created_at: string;
  category: { name: string } | null;
  vendor_id: string;
  vendor: { store_name: string | null; full_name: string | null } | null;
  product_images: { url: string }[];
}

function toAdminProduct(row: Record<string, unknown>): AdminProduct {
  const category = recordOrNull(row.category);
  const vendor = recordOrNull(row.vendor);
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    price: num(row.price),
    stock_quantity: num(row.stock_quantity),
    is_active: bool(row.is_active),
    featured: bool(row.featured),
    created_at: str(row.created_at),
    category: category ? { name: str(category.name) } : null,
    vendor_id: str(row.vendor_id),
    vendor: vendor ? { store_name: strOrNull(vendor.store_name), full_name: strOrNull(vendor.full_name) } : null,
    product_images: recordList(row.product_images)
      .map((image) => ({ url: str(image.url) }))
      .filter((image) => image.url),
  };
}

async function fetchProductsPage(params: ResolvedListParams<AdminProductFilter>): Promise<AdminListPage<AdminProduct>> {
  const { data, error } = await supabase.rpc(RPC, { ...pagingArgs(params), p_filter: params.filter });
  if (error) throw adminRpcError(RPC, error, params);
  return parseAdminListResult(data, RPC, toAdminProduct);
}

type ProductPatch = Partial<Pick<AdminProduct, "featured" | "is_active">>;
type Snapshot = [QueryKey, AdminListPage<AdminProduct> | undefined][];

/** One page of products (deleted ones left out), searched and filtered in the database. */
export function useAdminProducts(params: AdminListParams<AdminProductFilter> = {}) {
  const queryClient = useQueryClient();
  const resolved = resolveListParams(params, DEFAULT_PRODUCT_FILTER);

  const productsQuery = useQuery({
    queryKey: [...LIST_KEY, resolved],
    queryFn: () => fetchProductsPage(resolved),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });

  /** Flips the switch at once on every cached page; the snapshot puts it back if the save fails. */
  const patchCachedProduct = async (productId: string, patch: ProductPatch): Promise<Snapshot> => {
    await queryClient.cancelQueries({ queryKey: LIST_KEY });
    const snapshot: Snapshot = queryClient.getQueriesData<AdminListPage<AdminProduct>>({ queryKey: LIST_KEY });
    queryClient.setQueriesData<AdminListPage<AdminProduct>>({ queryKey: LIST_KEY }, (page) =>
      page ? { ...page, rows: page.rows.map((row) => (row.id === productId ? { ...row, ...patch } : row)) } : page,
    );
    return snapshot;
  };

  const restoreSnapshot = (snapshot: Snapshot | undefined) => {
    snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
  };

  const updateProduct = async (productId: string, patch: ProductPatch) => {
    const { error } = await supabase.from("products").update(patch).eq("id", productId);
    if (error) {
      console.error("[useAdminProducts] update failed", { productId, patch, error });
      throw new Error(error.message);
    }
  };

  const toggleFeatured = useMutation({
    mutationFn: ({ productId, featured }: { productId: string; featured: boolean }) => updateProduct(productId, { featured }),
    onMutate: ({ productId, featured }) => patchCachedProduct(productId, { featured }),
    onError: (_error, _vars, snapshot) => restoreSnapshot(snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ productId, isActive }: { productId: string; isActive: boolean }) =>
      updateProduct(productId, { is_active: isActive }),
    onMutate: ({ productId, isActive }) => patchCachedProduct(productId, { is_active: isActive }),
    onError: (_error, _vars, snapshot) => restoreSnapshot(snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const deleteProduct = useMutation({
    mutationFn: (productId: string) => removeProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  return {
    products: productsQuery.data?.rows ?? [],
    total: productsQuery.data?.total ?? 0,
    isLoading: productsQuery.isLoading,
    isFetching: productsQuery.isFetching,
    isPlaceholderData: productsQuery.isPlaceholderData,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    toggleFeatured,
    toggleActive,
    deleteProduct,
  };
}
