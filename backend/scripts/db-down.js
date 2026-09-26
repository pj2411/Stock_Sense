const { execFileSync, spawnSync } = require("node:child_process");

function available(command, args = ["--version"]) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

if (available("docker", ["compose", "version"])) {
  execFileSync("docker", ["compose", "down"], { stdio: "inherit" });
} else if (available("brew")) {
  const service = spawnSync("brew", ["services", "stop", "postgresql@16"], { stdio: "inherit" });
  if (service.status !== 0) {
    const pgCtl = process.arch === "arm64" ? "/opt/homebrew/opt/postgresql@16/bin/pg_ctl" : "/usr/local/opt/postgresql@16/bin/pg_ctl";
    execFileSync(pgCtl, ["-D", process.arch === "arm64" ? "/opt/homebrew/var/postgresql@16" : "/usr/local/var/postgresql@16", "stop"], { stdio: "inherit" });
  }
} else {
  console.log("No Docker or Homebrew PostgreSQL service found.");
}
