// Countries offered when adding a workplace by hand (names in the "Countries" messages).
export const COUNTRIES = ["HU", "AE", "US", "GB", "AT", "DE", "SK", "RO"] as const;
export type Country = (typeof COUNTRIES)[number];

// Countries where pay is usually quoted per month (otherwise per hour).
export const MONTHLY_PAY = new Set(["HU", "AE"]);
