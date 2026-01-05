import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 10;

interface RecentProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl?: string;
  viewedAt: number;
}

export function useRecentlyViewed() {
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentProduct[];
        // Filter out items older than 7 days
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const filtered = parsed.filter(p => p.viewedAt > weekAgo);
        setRecentProducts(filtered);
      }
    } catch (e) {
      console.error('Failed to load recently viewed', e);
    }
  }, []);

  // Add product to recently viewed
  const addProduct = useCallback((product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    imageUrl?: string;
  }) => {
    setRecentProducts(prev => {
      // Remove if already exists
      const filtered = prev.filter(p => p.id !== product.id);
      
      // Add to front
      const updated = [
        { ...product, viewedAt: Date.now() },
        ...filtered
      ].slice(0, MAX_ITEMS);
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recently viewed', e);
      }
      
      return updated;
    });
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setRecentProducts([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentProducts,
    addProduct,
    clearAll,
  };
}
