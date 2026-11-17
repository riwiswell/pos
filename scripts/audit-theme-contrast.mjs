import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");

function blockFor(selector) {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error("Theme block not found: " + selector);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("Unclosed CSS block: " + selector);
}

function tokensFrom(block) {
  const tokens = {};
  for (const match of block.matchAll(/--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)) {
    tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return tokens;
}

function oklchToRgb([L, C, hue]) {
  const h = hue * Math.PI / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return linear.map((value) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  });
}

function luminance(rgb) {
  const linear = rgb.map((value) => value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const values = [luminance(oklchToRgb(a)), luminance(oklchToRgb(b))].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const pairs = [
  ["foreground/background", "foreground", "background", 4.5],
  ["surface text", "surface-foreground", "surface", 4.5],
  ["card text", "card-foreground", "card", 4.5],
  ["popover text", "popover-foreground", "popover", 4.5],
  ["primary button", "primary-foreground", "primary", 4.5],
  ["secondary button", "secondary-foreground", "secondary", 4.5],
  ["muted text", "muted-foreground", "muted", 4.5],
  ["accent text", "accent-foreground", "accent", 4.5],
  ["destructive button", "destructive-foreground", "destructive", 4.5],
  ["success button", "success-foreground", "success", 4.5],
  ["sidebar text", "sidebar-foreground", "sidebar", 4.5],
  ["sidebar primary", "sidebar-primary-foreground", "sidebar-primary", 4.5],
  ["sidebar accent", "sidebar-accent-foreground", "sidebar-accent", 4.5],
  ["finance income chart", "chart-income", "card", 3],
  ["finance expense chart", "chart-expense", "card", 3],
];

let failures = 0;
for (const [name, selector] of [["oscuro", ":root"], ["claro", ".theme-light"]]) {
  const tokens = tokensFrom(blockFor(selector));
  console.log("\nTema " + name + ":");
  for (const [label, foreground, background, minimum] of pairs) {
    if (!tokens[foreground] || !tokens[background]) {
      console.error("  FALTA TOKEN: " + label);
      failures += 1;
      continue;
    }
    const ratio = contrast(tokens[foreground], tokens[background]);
    const passed = ratio >= minimum;
    console.log("  " + (passed ? "OK " : "FALLO ") + label + ": " + ratio.toFixed(2) + ":1 (mín. " + minimum + ":1)");
    if (!passed) failures += 1;
  }
}

if (failures) {
  console.error("\nAuditoría de contraste fallida: " + failures + " problema(s).");
  process.exitCode = 1;
} else {
  console.log("\nAuditoría de contraste aprobada para ambos temas.");
}
