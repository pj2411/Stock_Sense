import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { createApp } from "./app";

async function main() {
  await prisma.$connect();
  const server = createApp().listen(env.PORT, () => console.log(`StockSense API listening on http://localhost:${env.PORT}`));
  const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
