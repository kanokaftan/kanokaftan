/**
 * Distance-based shipping calculation with order value discounts and promo codes
 */

import { supabase } from "@/integrations/supabase/client";

// Shipping price tiers by distance (in km) - Rebalanced for better pricing
const DISTANCE_TIERS = [
  { maxKm: 5, fee: 800 },
  { maxKm: 10, fee: 1200 },
  { maxKm: 20, fee: 1800 },
  { maxKm: 50, fee: 2500 },
  { maxKm: 100, fee: 3500 },
  { maxKm: 200, fee: 5000 },
  { maxKm: 300, fee: 6500 },
  { maxKm: Infinity, fee: 8000 },
];

// Order value discount tiers
const VALUE_DISCOUNTS = [
  { minValue: 500000, discount: 0.70 }, // 70% off
  { minValue: 200000, discount: 0.50 }, // 50% off
  { minValue: 100000, discount: 0.35 }, // 35% off
  { minValue: 50000, discount: 0.20 },  // 20% off
  { minValue: 0, discount: 0 },          // No discount
];

// Default shipping fee when distance can't be calculated
export const DEFAULT_SHIPPING_FEE = 2500;

// Min and max shipping fees for display
export const MIN_SHIPPING_FEE = 800;
export const MAX_SHIPPING_FEE = 8000;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get base shipping fee by distance
 */
export function getBaseFeeByDistance(distanceKm: number): number {
  for (const tier of DISTANCE_TIERS) {
    if (distanceKm <= tier.maxKm) {
      return tier.fee;
    }
  }
  return DISTANCE_TIERS[DISTANCE_TIERS.length - 1].fee;
}

/**
 * Get discount percentage by order value
 */
export function getDiscountByValue(subtotal: number): number {
  for (const tier of VALUE_DISCOUNTS) {
    if (subtotal >= tier.minValue) {
      return tier.discount;
    }
  }
  return 0;
}

/**
 * Get next discount tier info for progress display
 */
export function getNextDiscountTier(subtotal: number): { 
  nextThreshold: number; 
  nextDiscount: number; 
  amountNeeded: number 
} | null {
  // Find the next tier above current subtotal
  const sortedTiers = [...VALUE_DISCOUNTS].sort((a, b) => a.minValue - b.minValue);
  
  for (const tier of sortedTiers) {
    if (tier.minValue > subtotal) {
      return {
        nextThreshold: tier.minValue,
        nextDiscount: tier.discount,
        amountNeeded: tier.minValue - subtotal,
      };
    }
  }
  
  return null; // Already at max discount
}

export interface PromoCode {
  code: string;
  discount_type: 'free' | 'percentage';
  discount_value: number;
}

export interface PromoCodeResult {
  valid: boolean;
  code?: string;
  discountType?: 'free' | 'percentage';
  discountValue?: number;
  error?: string;
}

/**
 * Validate a shipping promo code
 */
export async function validatePromoCode(code: string): Promise<PromoCodeResult> {
  if (!code?.trim()) {
    return { valid: false, error: 'Please enter a promo code' };
  }

  const { data, error } = await supabase
    .from('shipping_promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Invalid promo code' };
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'This promo code has expired' };
  }

  return {
    valid: true,
    code: data.code,
    discountType: data.discount_type as 'free' | 'percentage',
    discountValue: data.discount_value,
  };
}

/**
 * Calculate final shipping fee with distance, order value discount, and promo code
 */
export function calculateShippingFee(
  distanceKm: number | null,
  subtotal: number,
  promoCode?: PromoCodeResult
): { 
  baseFee: number; 
  discount: number; 
  discountAmount: number; 
  finalFee: number; 
  distanceKm: number | null;
  promoApplied: boolean;
  promoDescription?: string;
} {
  const baseFee = distanceKm !== null 
    ? getBaseFeeByDistance(distanceKm) 
    : DEFAULT_SHIPPING_FEE;
  
  // Check if promo code gives better discount
  if (promoCode?.valid) {
    if (promoCode.discountType === 'free') {
      return {
        baseFee,
        discount: 1, // 100%
        discountAmount: baseFee,
        finalFee: 0,
        distanceKm,
        promoApplied: true,
        promoDescription: 'Free shipping applied!',
      };
    } else if (promoCode.discountType === 'percentage') {
      const promoDiscount = (promoCode.discountValue || 0) / 100;
      const discountAmount = Math.round(baseFee * promoDiscount);
      return {
        baseFee,
        discount: promoDiscount,
        discountAmount,
        finalFee: baseFee - discountAmount,
        distanceKm,
        promoApplied: true,
        promoDescription: `${promoCode.discountValue}% off shipping!`,
      };
    }
  }
  
  // Fall back to value-based discount
  const discount = getDiscountByValue(subtotal);
  const discountAmount = Math.round(baseFee * discount);
  const finalFee = baseFee - discountAmount;
  
  return {
    baseFee,
    discount,
    discountAmount,
    finalFee,
    distanceKm,
    promoApplied: false,
  };
}

/**
 * Format shipping fee for display
 */
export function formatShippingRange(): string {
  return `₦${MIN_SHIPPING_FEE.toLocaleString()} - ₦${MAX_SHIPPING_FEE.toLocaleString()}`;
}

/**
 * Get discount tier description
 */
export function getDiscountTierDescription(subtotal: number): string | null {
  const discount = getDiscountByValue(subtotal);
  if (discount === 0) return null;
  return `${Math.round(discount * 100)}% off shipping`;
}