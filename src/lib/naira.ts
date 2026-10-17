/** ₦45,000 or ₦1,250.50: whole naira when there are no kobo. */
export const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
