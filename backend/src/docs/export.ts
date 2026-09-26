import { writeFile } from "node:fs/promises";
import { openapi } from "./openapi";

async function main() {
  await writeFile("openapi.json", JSON.stringify(openapi, null, 2));
  console.log("Wrote openapi.json");
}

void main();
