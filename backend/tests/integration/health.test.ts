import { createApp } from "../../src/app";

describe("health endpoint", () => {
  it("returns the service health envelope", async () => {
    const app = createApp() as any;
    const route = app._router.stack.find((layer: any) => layer.route?.path === "/health");
    expect(route).toBeDefined();
    const response = { json: vi.fn() };
    route.route.stack[0].handle({}, response);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { service: "stocksense-backend", status: "ok" } });
  });
});
