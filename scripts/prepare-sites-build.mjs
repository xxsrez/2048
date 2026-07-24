import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const BUILD_DIRECTORY = resolve("dist");
const WORKER_TEMPLATE = resolve("worker/index.js");
const WORKER_OUTPUT = resolve(BUILD_DIRECTORY, "server/index.js");
const MANIFEST_PLACEHOLDER = "__SITES_ASSET_MANIFEST__";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      (entry.name === "server" || entry.name === ".openai")
    ) {
      continue;
    }

    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

const manifest = {};

for (const file of (await listFiles(BUILD_DIRECTORY)).sort()) {
  const pathname = `/${relative(BUILD_DIRECTORY, file).split(sep).join("/")}`;
  const extension = extname(file).toLowerCase();
  const contents = await readFile(file);

  manifest[pathname] = {
    body: contents.toString("base64"),
    contentType: contentTypes.get(extension) ?? "application/octet-stream",
  };
}

const template = await readFile(WORKER_TEMPLATE, "utf8");

if (!template.includes(MANIFEST_PLACEHOLDER)) {
  throw new Error("Sites worker template is missing its asset manifest placeholder.");
}

await mkdir(resolve(BUILD_DIRECTORY, "server"), { recursive: true });
await writeFile(
  WORKER_OUTPUT,
  template.replace(MANIFEST_PLACEHOLDER, JSON.stringify(manifest)),
);
