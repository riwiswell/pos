import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
const skinSource = fs.readFileSync(path.join(root, "src/domain/skins.ts"), "utf8");

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

function parseColor(value) {
  const oklch = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (oklch) return { oklch: [Number(oklch[1]), Number(oklch[2]), Number(oklch[3])] };
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join("");
    return { rgb: [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16) / 255) };
  }
  return null;
}

function tokensFrom(block) {
  const tokens = {};
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const color = parseColor(match[2].trim());
    if (color) tokens[match[1]] = color;
  }
  return tokens;
}

function rulesFrom(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().split(",").map((selector) => selector.trim()),
    body: match[2],
  }));
}

function toRgb(color) {
  if (color.rgb) return color.rgb;
  const [L, C, hue] = color.oklch;
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

function luminance(color) {
  const linear = toRgb(color).map((value) => value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
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

const rules = rulesFrom(css);
const skinIds = [...skinSource.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
let failures = 0;
let checks = 0;

for (const [mode, baseSelector] of [["oscuro", ":root"], ["claro", ".theme-light"]]) {
  const baseTokens = tokensFrom(blockFor(baseSelector));
  for (const skin of skinIds) {
    const tokens = { ...baseTokens };
    for (const rule of rules) {
      const applies = rule.selectors.some((selector) =>
        selector === 'html[data-skin="' + skin + '"]' ||
        (mode === "claro" && selector === 'html.theme-light[data-skin="' + skin + '"]'),
      );
      if (applies) Object.assign(tokens, tokensFrom(rule.body));
    }
    const skinFailures = [];
    for (const [label, foreground, background, minimum] of pairs) {
      checks += 1;
      if (!tokens[foreground] || !tokens[background]) {
        skinFailures.push(label + ": falta un token");
        continue;
      }
      const ratio = contrast(tokens[foreground], tokens[background]);
      if (ratio < minimum) skinFailures.push(label + ": " + ratio.toFixed(2) + ":1 (mín. " + minimum + ":1)");
    }
    if (skinFailures.length) {
      failures += skinFailures.length;
      console.error("FALLO · " + skin + " · " + mode + ": " + skinFailures.join("; "));
    }
  }
}

console.log("Comprobaciones: " + checks + " pares de contraste en " + skinIds.length + " skins y ambos temas.");
if (failures) {
  console.error("Auditoría de contraste fallida: " + failures + " problema(s).");
  process.exitCode = 1;
} else {
  console.log("Auditoría de contraste aprobada: todos los pares cumplen WCAG AA para texto y 3:1 para gráficos.");
}
