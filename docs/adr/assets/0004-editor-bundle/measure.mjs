import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const kb = (n) => `${Math.round(n / 1024)} KB`;
const gz = (f) => gzipSync(readFileSync(f), { level: 9 }).length;
console.log("| Bundle | Initial JS min | Initial JS gzip | Lazy JS gzip (on demand) | CSS gzip |");
console.log("|---|---:|---:|---:|---:|");
for (const name of ["cm", "monaco-min", "monaco-worker"]) {
  const meta = JSON.parse(readFileSync(`out/${name}.meta.json`, "utf8"));
  const outs = meta.outputs;
  const entry = Object.keys(outs).find((k) => outs[k].entryPoint);
  const initial = new Set();
  const walk = (f) => {
    if (initial.has(f)) return;
    initial.add(f);
    for (const imp of outs[f].imports)
      if (imp.kind === "import-statement" && imp.path.endsWith(".js")) walk(imp.path);
  };
  walk(entry);
  const js = Object.keys(outs).filter((k) => k.endsWith(".js"));
  const css = Object.keys(outs).filter((k) => k.endsWith(".css"));
  const sum = (fs, f) => fs.reduce((a, x) => a + f(x), 0);
  const initMin = sum([...initial], (f) => outs[f].bytes);
  const initGz = sum([...initial], gz);
  const lazyGz = sum(
    js.filter((f) => !initial.has(f)),
    gz,
  );
  console.log(`| ${name} | ${kb(initMin)} | ${kb(initGz)} | ${kb(lazyGz)} | ${kb(sum(css, gz))} |`);
}
