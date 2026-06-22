const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const csvPath = path.join(dataDir, "products.csv");
const manifestPath = path.join(dataDir, "product-images.json");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  if (!headers) return [];

  return records.map((record) =>
    headers.reduce((item, header, index) => {
      item[header] = record[index] ?? "";
      return item;
    }, {}),
  );
}

function getProductId(product) {
  return String(product.id || product["product number"] || "").trim();
}

const csv = stripBom(fs.readFileSync(csvPath, "utf8"));
const products = parseCsv(csv);
const manifest = {};
const missing = [];

for (const product of products) {
  const id = getProductId(product);
  if (!id) {
    missing.push("(blank id)");
    continue;
  }

  const folder = path.join(dataDir, id);
  const images = fs.existsSync(folder)
    ? fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
        .map((fileName) => `data/${id}/${fileName}`)
    : [];

  manifest[id] = images;
  if (images.length === 0) missing.push(id);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const totalImages = Object.values(manifest).reduce((sum, images) => sum + images.length, 0);
console.log(`Generated data/product-images.json for ${Object.keys(manifest).length} products and ${totalImages} images.`);

if (missing.length > 0) {
  throw new Error(`Products without image folders/images: ${missing.join(", ")}`);
}
