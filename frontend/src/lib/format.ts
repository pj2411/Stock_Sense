export function number(value: unknown) { const parsed = Number(value ?? 0); return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(Number.isFinite(parsed) ? parsed : 0); }
export function currency(value: unknown) { const parsed = Number(value ?? 0); return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(parsed) ? parsed : 0); }
export function date(value?: string) { return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—"; }
export function title(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
