import { useState, useEffect } from "react";

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("kk_cart");
    if (stored) setItems(JSON.parse(stored));
  }, []);

  const save = (newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem("kk_cart", JSON.stringify(newItems));
  };

  const addToCart = (item: CartItem) => {
    const existing = items.find((i) => i.product_id === item.product_id);
    if (existing) {
      save(items.map((i) =>
        i.product_id === item.product_id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      save([...items, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (product_id: string) => {
    save(items.filter((i) => i.product_id !== product_id));
  };

  const clearCart = () => save([]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const mergeSessionCart = async (_userId: string) => {
    // No-op — cart is local only now
  };

  return { items, addToCart, removeFromCart, clearCart, count, total, mergeSessionCart };
}
