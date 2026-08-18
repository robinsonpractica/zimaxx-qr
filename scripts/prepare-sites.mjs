import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await writeFile(
  "dist/server/index.js",
  'export { default } from "../_worker.js/index.js";\nexport * from "../_worker.js/index.js";\n',
);

await mkdir("dist/.openai/drizzle", { recursive: true });
for (const file of await readdir("db/migrations")) {
  if (file.endsWith(".sql")) {
    await copyFile(`db/migrations/${file}`, `dist/.openai/drizzle/${file}`);
  }
}
