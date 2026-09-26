const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");

const dbUser = process.env.STOCKSENSE_DB_USER || "stocksense";
const dbPassword = process.env.STOCKSENSE_DB_PASSWORD || "stocksense";
const dbName = process.env.STOCKSENSE_DB_NAME || "stocksense";
const brewPostgres = process.arch === "arm64"
  ? "/opt/homebrew/opt/postgresql@16/bin"
  : "/usr/local/opt/postgresql@16/bin";

function available(command, args = ["--version"]) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: "inherit", ...options });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function optionalOutput(command, args) {
  try {
    return output(command, args);
  } catch {
    return "";
  }
}

function ensureHomebrewDatabase() {
  if (!available("brew")) {
    console.error("Neither Docker nor Homebrew is installed. Install Docker Desktop or Homebrew first.");
    process.exit(1);
  }
  if (!optionalOutput("brew", ["list", "--versions", "postgresql@16"])) {
    console.error("PostgreSQL 16 is not installed.");
    console.error("Run: brew install postgresql@16");
    console.error("Then run: npm run db:up");
    process.exit(1);
  }

  const psql = fs.existsSync(`${brewPostgres}/psql`) ? `${brewPostgres}/psql` : "psql";
  const pgIsReady = fs.existsSync(`${brewPostgres}/pg_isready`) ? `${brewPostgres}/pg_isready` : "pg_isready";
  const pgCtl = fs.existsSync(`${brewPostgres}/pg_ctl`) ? `${brewPostgres}/pg_ctl` : "pg_ctl";
  const dataDirectory = process.arch === "arm64" ? "/opt/homebrew/var/postgresql@16" : "/usr/local/var/postgresql@16";
  const service = spawnSync("brew", ["services", "start", "postgresql@16"], { stdio: "inherit" });
  if (service.status !== 0) {
    console.warn("Homebrew service manager was unavailable; starting PostgreSQL directly.");
    run(pgCtl, ["-D", dataDirectory, "-l", `${dataDirectory}/server.log`, "start"]);
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (spawnSync(pgIsReady, ["-h", "127.0.0.1", "-p", "5432"], { stdio: "ignore" }).status === 0) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (spawnSync(pgIsReady, ["-h", "127.0.0.1", "-p", "5432"], { stdio: "ignore" }).status !== 0) {
    console.error("PostgreSQL was started but is not accepting connections on localhost:5432.");
    process.exit(1);
  }

  const roleExists = optionalOutput(psql, ["-d", "postgres", "-tAc", `SELECT 1 FROM pg_roles WHERE rolname='${dbUser}'`]);
  if (!roleExists) run(psql, ["-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `CREATE ROLE ${dbUser} LOGIN PASSWORD '${dbPassword}'`]);
  const databaseExists = optionalOutput(psql, ["-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${dbName}'`]);
  if (!databaseExists) run(psql, ["-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${dbName} OWNER ${dbUser}`]);
  console.log(`PostgreSQL is ready at localhost:5432/${dbName}`);
}

if (available("docker", ["compose", "version"])) {
  run("docker", ["compose", "up", "-d", "postgres"]);
} else {
  ensureHomebrewDatabase();
}
