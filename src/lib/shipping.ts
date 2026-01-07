/**
 * Distance-based shipping calculation with order value discounts
 */

// Shipping price tiers by distance (in km)
const DISTANCE_TIERS = [
  { maxKm: 5, fee: 1500 },
  { maxKm: 10, fee: 2000 },
  { maxKm: 20, fee: 2800 },
  { maxKm: 50, fee: 4000 },
  { maxKm: 100, fee: 5500 },
  { maxKm: 200, fee: 7000 },
  { maxKm: 300, fee: 8500 },
  { maxKm: Infinity, fee: 10000 },
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
export const DEFAULT_SHIPPING_FEE = 5000;

// Min and max shipping fees for display
export const MIN_SHIPPING_FEE = 1500;
export const MAX_SHIPPING_FEE = 10000;

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

/**
 * Calculate final shipping fee with distance and order value discount
 */
export function calculateShippingFee(
  distanceKm: number | null,
  subtotal: number
): { 
  baseFee: number; 
  discount: number; 
  discountAmount: number; 
  finalFee: number; 
  distanceKm: number | null;
} {
  const baseFee = distanceKm !== null 
    ? getBaseFeeByDistance(distanceKm) 
    : DEFAULT_SHIPPING_FEE;
  
  const discount = getDiscountByValue(subtotal);
  const discountAmount = Math.round(baseFee * discount);
  const finalFee = baseFee - discountAmount;
  
  return {
    baseFee,
    discount,
    discountAmount,
    finalFee,
    distanceKm,
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
