import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PROHIBITED = [
  "dispatch_emergency", "auto_dispatch", "automated_distress",
  "predict_safe", "safe_area_inference",
  "smooth_breadcrumb", "modify_breadcrumb", "delete_breadcrumb",
  "cloud_nav", "cloud_navigation", "online_navigation",
  "consolidate_hazard", "merge_hazard",
];

const SCAN_EXTENSIONS = [".ts", ".js", ".tsx", ".jsx"];
const IGNORE_DIRS = ["node_modules", "dist", ".git", "docs", "scripts"];

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (SCAN_EXTENSIONS.includes(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;
for (const file of walk(process.cwd())) {
  const content = readFileSync(file, "utf-8");
  for (const term of PROHIBITED) {
    if (content.includes(term)) {
      console.error(`PROHIBITED [${term}] found in ${file}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} prohibited trigger(s) found. Build rejected.`);
  process.exit(1);
} else {
  console.log("No prohibited triggers found. OK.");
}
