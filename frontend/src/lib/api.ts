import type { AuditLog, Category, Dashboard, Document, InventoryBalance, LedgerEntry, Location, Notification, Product, ReorderRule, Supplier, Uom, User, Warehouse } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string; details?: unknown } };
type AuthResponse = { user: User; accessToken: string; refreshToken: string };

class ApiError extends Error { constructor(public code: string, message: string, public details?: unknown) { super(message); } }

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !payload || !payload.success) {
    const error = payload && !payload.success ? payload.error : { code: "NETWORK_ERROR", message: "The API did not return a valid response" };
    throw new ApiError(error.code, error.message, error.details);
  }
  return payload.data;
}

class StockSenseApi {
  private accessToken = localStorage.getItem("stocksense.accessToken");
  private refreshToken = localStorage.getItem("stocksense.refreshToken");
  private async request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("content-type", "application/json");
    if (this.accessToken) headers.set("authorization", `Bearer ${this.accessToken}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (response.status === 401 && retry && this.refreshToken && !path.includes("/auth/refresh")) {
      try { await this.refresh(); return this.request<T>(path, options, false); } catch { this.clearSession(); }
    }
    return parse<T>(response);
  }
  private saveSession(value: AuthResponse) { this.accessToken = value.accessToken; this.refreshToken = value.refreshToken; localStorage.setItem("stocksense.accessToken", value.accessToken); localStorage.setItem("stocksense.refreshToken", value.refreshToken); localStorage.setItem("stocksense.user", JSON.stringify(value.user)); }
  private clearSession() { this.accessToken = null; this.refreshToken = null; localStorage.removeItem("stocksense.accessToken"); localStorage.removeItem("stocksense.refreshToken"); localStorage.removeItem("stocksense.user"); }
  get hasSession() { return Boolean(this.accessToken); }
  get storedUser(): User | null { const value = localStorage.getItem("stocksense.user"); return value ? JSON.parse(value) as User : null; }
  async login(email: string, password: string) { const value = await this.request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); this.saveSession(value); return value; }
  async register(name: string, email: string, password: string) { const value = await this.request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }); this.saveSession(value); return value; }
  async refresh() { if (!this.refreshToken) throw new ApiError("UNAUTHENTICATED", "Session expired"); const value = await this.request<AuthResponse>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: this.refreshToken }) }, false); this.saveSession(value); return value; }
  async logout() { if (this.refreshToken) await this.request("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: this.refreshToken }) }, false).catch(() => undefined); this.clearSession(); }
  async forgotPassword(email: string) { return this.request<{ accepted: boolean; debugOtp?: string }>("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) }); }
  async verifyOtp(email: string, otp: string) { return this.request<{ resetToken: string }>("/auth/password/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) }); }
  async resetPassword(resetToken: string, password: string) { return this.request<{ reset: boolean }>("/auth/password/reset", { method: "POST", body: JSON.stringify({ resetToken, password }) }); }
  async me() { const value = await this.request<User>("/auth/me"); localStorage.setItem("stocksense.user", JSON.stringify(value)); return value; }

  async dashboard() { return this.request<Dashboard>("/dashboard"); }
  async products(search = "") { return this.request<Product[]>(`/products${search ? `?search=${encodeURIComponent(search)}` : ""}`); }
  async product(id: string) { return this.request<Product>(`/products/${id}`); }
  async createProduct(body: unknown) { return this.request<Product>("/products", { method: "POST", body: JSON.stringify(body) }); }
  async updateProduct(id: string, body: unknown) { return this.request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }
  async categories() { return this.request<Category[]>("/categories"); }
  async uoms() { return this.request<Uom[]>("/uoms"); }
  async warehouses() { return this.request<Warehouse[]>("/warehouses"); }
  async locations() { return this.request<Location[]>("/locations"); }
  async suppliers() { return this.request<Supplier[]>("/suppliers"); }
  async createResource(resource: string, body: unknown) { return this.request(`/${resource}`, { method: "POST", body: JSON.stringify(body) }); }
  async updateResource(resource: string, id: string, body: unknown) { return this.request(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }
  async openingInventory(body: unknown) { return this.request<InventoryBalance>("/inventory/opening", { method: "POST", body: JSON.stringify(body) }); }
  async inventory(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return this.request<InventoryBalance[]>(`/inventory${query ? `?${query}` : ""}`); }
  async ledger(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return this.request<LedgerEntry[]>(`/stock-ledger${query ? `?${query}` : ""}`); }
  async listDocuments(type: "receipts" | "deliveries" | "transfers" | "adjustments", search = "") { return this.request<Document[]>(`/${type}${search ? `?search=${encodeURIComponent(search)}` : ""}`); }
  async document(type: string, id: string) { return this.request<Document>(`/${type}/${id}`); }
  async createDocument(type: string, body: unknown) { return this.request<Document>(`/${type}`, { method: "POST", body: JSON.stringify(body) }); }
  async addItem(type: string, id: string, body: unknown) { return this.request(`/${type}/${id}/items`, { method: "POST", body: JSON.stringify(body) }); }
  async transition(type: string, id: string, action: string) { return this.request<Document>(`/${type}/${id}/${action}`, { method: "POST" }); }
  async reorderRules() { return this.request<ReorderRule[]>("/reorder-rules"); }
  async createReorderRule(body: unknown) { return this.request<ReorderRule>("/reorder-rules", { method: "POST", body: JSON.stringify(body) }); }
  async updateReorderRule(id: string, body: unknown) { return this.request<ReorderRule>(`/reorder-rules/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }
  async deleteReorderRule(id: string) { return this.request(`/reorder-rules/${id}`, { method: "DELETE" }); }
  async notifications(unreadOnly = false) { return this.request<Notification[]>(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`); }
  async markNotificationRead(id: string) { return this.request(`/notifications/${id}/read`, { method: "PATCH" }); }
  async auditLogs(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return this.request<AuditLog[]>(`/audit-logs${query ? `?${query}` : ""}`); }
}

export const api = new StockSenseApi();
export { ApiError };
