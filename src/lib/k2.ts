/** K² credit: 1 K² = ₦1, spent only inside Kano Kaftan, never withdrawn. */
export const k2 = (amount: number) =>
  `${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(Number(amount) || 0)} K²`;
