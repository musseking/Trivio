import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = join(root, "frontend");
const envPath = join(root, ".env");
const windows = process.platform === "win32";

function fail(message) {
  console.error(`\n[TRIVIO] ${message}`);
  process.exit(1);
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: windows
  });

  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    fail(`${command} exited with code ${result.status}`);
  }
}

if (!existsSync(envPath)) {
  fail("Root .env is missing.");
}

const envText = readFileSync(envPath, "utf8");

const portMatch = envText.match(
  /^\s*TRIVIO_GATEWAY_HOST_PORT\s*=\s*["']?(\d+)["']?\s*$/m
);

const portText = process.env.TRIVIO_GATEWAY_HOST_PORT ||
  portMatch?.[1];

const port = Number(portText);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  fail("Invalid or missing TRIVIO_GATEWAY_HOST_PORT.");
}

const apiTarget = process.env.TRIVIO_API_PROXY_TARGET?.trim() ||
  `http://127.0.0.1:${port}`;

console.log("\n================================");
console.log("       TRIVIO DEVELOPMENT");
console.log("================================\n");

console.log("[1/3] Starting Docker infrastructure...");

const composeArgs = ["compose", "up", "-d"];

if (process.argv.includes("--build")) {
  composeArgs.push("--build");
}

run("docker", composeArgs);

console.log("\n[TRIVIO] Waiting for backend readiness...");

const statusUrl = new URL("/api/auth/setup/status", apiTarget);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const deadline = Date.now() + 120_000;
let ready = false;
let lastStatus = "No response";

while (Date.now() < deadline) {
  try {
    const response = await fetch(statusUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000)
    });

    if (response.ok) {
      const data = await response.json();

      if (typeof data?.setupAvailable === "boolean") {
        ready = true;
        break;
      }

      lastStatus = "Invalid setup status response";
    } else {
      lastStatus = `HTTP ${response.status}`;
    }
  } catch {
    lastStatus = "Connection unavailable";
  }

  await sleep(2000);
}

if (!ready) {
  fail(
    `Backend is not ready (${lastStatus}). ` +
    "Inspect api-gateway and auth-service logs."
  );
}

console.log("[TRIVIO] Backend is ready.");

console.log("\n[2/3] Checking frontend dependencies...");

if (!existsSync(join(frontend, "node_modules", "vite"))) {
  if (existsSync(join(frontend, "package-lock.json"))) {
    run("npm", ["ci"], frontend);
  } else {
    run("npm", ["install"], frontend);
  }
} else {
  console.log("Frontend dependencies already installed.");
}

console.log("\n[3/3] Starting Vite...");
console.log(`API proxy: ${apiTarget}`);
console.log("Frontend: http://localhost:5173/");
console.log("\nCtrl+C stops Vite; Docker services stay running.\n");

const child = spawn(
  "npm",
  ["--prefix", "frontend", "run", "dev"],
  {
    cwd: root,
    stdio: "inherit",
    shell: windows,
    env: {
      ...process.env,
      TRIVIO_API_PROXY_TARGET: apiTarget
    }
  }
);

child.on("error", (error) => {
  console.error("[TRIVIO] Frontend error:", error.message);
  process.exitCode = 1;
});

child.on("close", (code) => {
  process.exitCode = code ?? 1;
});