const { execFileSync, spawnSync } = require("node:child_process");

function available(command, args = ["--version"]) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

if (available("docker", ["compose", "version"])) {
  execFileSync("docker", ["compose", "ps", "postgres"], { stdio: "inherit" });
} else if (available("brew")) {
  execFileSync("brew", ["services", "info", "postgresql@16"], { stdio: "inherit" });
} else {
  console.log("No Docker or Homebrew PostgreSQL service found.");
}
