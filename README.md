# MY Products Catalog

A static product catalog website showcasing American-imported products for users in Tam Ky, Quang Nam. It reads product data from CSV files and displays real product photos organized per-item.

## Features

- Search by product name, brand, benefits, or ingredients
- Filter by category and brand with quick-filter chips
- Sort: featured, A-Z, price asc/desc, category A-Z
- Detail pages per product: image gallery, specs, benefits, ingredients, usage, warnings
- Responsive design for mobile and desktop

## Project structure

```
.  
+-- index.html          # Main page + product listing
+-- styles.css          # Styles (546 lines)
+-- app.js              # App logic: CSV fetch, filtering, DOM rendering
+-- favicon.svg
+-- CNAME               # Custom domain (if any)
+-- .nojekyll
+-- data/
|   +-- products.csv    # Primary product data source
|   +-- product-images.json  # Image manifest: id -> image list
|   +-- <product_id>/   # Per-product image folders (2-8 photos each)
+-- product-images/     # Category-level fallback images
+-- scripts/
|   +-- generate-image-manifest.js  # Tool to regenerate the image manifest
+-- .github/
    +-- workflows/
        +-- deploy-pages.yml   # CI/CD for GitHub Pages
```

## Product data (data/products.csv)

| Column | Description |
|--------|-------------|
| id | Product identifier (primary key) |
| name | Slug / lowercase name |
| product_name-label | Display name |
| product links | Link to WareHouseRunner |
| brand | Brand |
| category | Product category |
| price_vnd | Price in VND (number) |
| price_label | Formatted price string |
| package_size | Package size/count |
| image_url | Thumbnail URL |
| short_description | Short description |
| key_benefits | Benefits, pipe-separated |
| active_ingredients | Active ingredients, pipe-separated |
| usage | Usage instructions |
| origin | Origin country |
| warning | Safety warnings |
| tags | Search tags (space-separated) |

Each product has its own folder under data/product_id/ with 2-8 detail images (jpg/webp).

## Setup and local dev

```bash
npm ci  # install deps if needed
npm run dev  # starts HTTP server on port 4173
# Browse http://localhost:4173
```

Note: needs an HTTP server. Opening the HTML directly will block CSV fetches due to CORS.

## Build and deploy

### GitHub Pages (auto CI/CD)

Every push to main or a manual workflow trigger builds and deploys the site automatically via GitHub Actions.

### Static hosting (manual)

Copy these files/folders to any static host:

- index.html, styles.css, app.js, favicon.svg
- data/ (entire folder with CSV + images)
- product-images/ (if present)

### Build script

```bash
npm run build
# Output: Website static ready: N products
```

## Tech stack

| Component | Technology |
|-----------|------------|
| HTML/CSS/JS | Vanilla, no framework |
| CSV parser | Custom (lines 47-83 of app.js) |
| Image gallery | Client-side lightbox in vanilla JS |
| Search + filter | Fully client-side |
| CI/CD | GitHub Actions (deploy-pages@v4) |
| Dev server | Python http.server |

## Adding a new product

1. Add a new row to data/products.csv with all required columns
2. Create folder data/product_id/ and place 2-8 detail images inside
3. Regenerate the manifest: npm run generate:manifest (if script exists)
4. Deploy to host

## Notes

- Images load from data/product_id/ per the mapping in product-images.json
- Some product IDs are Amazon ASINs (e.g., B06W9K61K7)
- Search normalizes Vietnamese Unicode diacritics (grave, acute, hook, tilde, dot below)
