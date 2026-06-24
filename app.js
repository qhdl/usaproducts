const CSV_URL = "data/products.csv";
const IMAGE_MANIFEST_URL = "data/product-images.json";

const state = {
  products: [],
  imageManifest: {},
  search: "",
  category: "",
  brand: "",
  sort: "featured",
  activeProductId: "",
};

const elements = {
  controlsBand: document.querySelector("#controlsBand"),
  searchInput: document.querySelector("#searchInput"),
  categorySelect: document.querySelector("#categorySelect"),
  brandSelect: document.querySelector("#brandSelect"),
  sortSelect: document.querySelector("#sortSelect"),
  resetButton: document.querySelector("#resetButton"),
  categoryChips: document.querySelector("#categoryChips"),
  productGrid: document.querySelector("#productGrid"),
  resultCount: document.querySelector("#resultCount"),
  resultTitle: document.querySelector("#resultTitle"),
  emptyState: document.querySelector("#emptyState"),
  statProducts: document.querySelector("#statProducts"),
  statCategories: document.querySelector("#statCategories"),
  statPrice: document.querySelector("#statPrice"),
  catalogShell: document.querySelector(".catalog-shell"),
  productDetail: document.querySelector("#productDetail"),
};

init();

async function init() {
  try {
    const [csvResponse, manifestResponse] = await Promise.all([
      fetch(CSV_URL),
      fetch(IMAGE_MANIFEST_URL),
    ]);

    if (!csvResponse.ok) throw new Error(`Không tải được ${CSV_URL}`);
    if (!manifestResponse.ok) throw new Error(`Không tải được ${IMAGE_MANIFEST_URL}`);

    const csv = stripBom(await csvResponse.text());
    state.imageManifest = JSON.parse(stripBom(await manifestResponse.text()));
    state.products = parseCsv(csv).map(normalizeProduct);
    state.activeProductId = getProductIdFromUrl();

    initTheme();
    populateFilters();
    updateStats();
    bindEvents();
    bindTheme();
    render();
  } catch (error) {
    elements.resultCount.textContent = "Không tải được dữ liệu sản phẩm.";
    elements.productGrid.innerHTML = `
      <article class="load-error">
        <h2>Không tải được dữ liệu</h2>
        <p>Hãy chạy website bằng máy chủ cục bộ hoặc hosting tĩnh để trình duyệt có thể tải CSV và manifest ảnh.</p>
      </article>
    `;
    console.error(error);
  }
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
  return records.map((record) =>
    headers.reduce((item, header, index) => {
      item[header] = record[index] ?? "";
      return item;
    }, {}),
  );
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeProduct(product, index) {
  const id = String(product.id || "").trim();
  const title = product["product_name-label"] || product.product_name || product.name || id;
  const slug = product.name || id;
  const warehouserunnerUrl = product["product links"] || product.warehouserunner || "";
  const images = (state.imageManifest[id] || []).filter(Boolean);
  const searchable = [
    id,
    slug,
    title,
    product.brand,
    product.category,
    product.short_description,
    product.key_benefits,
    product.active_ingredients,
    product.tags,
  ].join(" ");

  return {
    ...product,
    index,
    id,
    slug,
    title,
    warehouserunnerUrl,
    price_vnd: Number(product.price_vnd || 0),
    benefits: splitList(product.key_benefits),
    ingredients: splitList(product.active_ingredients),
    tags: splitList(product.tags),
    images,
    primaryImage: images[0] || "",
    searchable: normalizeSearch(searchable),
  };
}

function splitList(value) {
  return (value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = normalizeSearch(event.target.value);
    renderCatalog();
  });

  elements.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
    renderCatalog();
  });

  elements.brandSelect.addEventListener("change", (event) => {
    state.brand = event.target.value;
    renderCatalog();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderCatalog();
  });

  elements.resetButton.addEventListener("click", resetFilters);

  document.addEventListener("click", (event) => {
    const productLink = event.target.closest("[data-product-id]");
    if (productLink) {
      event.preventDefault();
      openProductById(productLink.dataset.productId);
      return;
    }

    const backButton = event.target.closest("[data-back-to-catalog]");
    if (backButton) {
      event.preventDefault();
      closeProductPage();
      return;
    }

    const thumbnail = event.target.closest("[data-gallery-src]");
    if (thumbnail) {
      const mainImage = document.querySelector("#detailMainImage");
      if (mainImage) {
        mainImage.src = thumbnail.dataset.gallerySrc;
        mainImage.alt = thumbnail.dataset.galleryAlt || mainImage.alt;
      }
      document.querySelectorAll("[data-gallery-src]").forEach((button) => {
        button.classList.toggle("is-active", button === thumbnail);
      });
    }
  });

  window.addEventListener("popstate", () => {
    state.activeProductId = getProductIdFromUrl();
    render();
  });
}

function populateFilters() {
  const categories = uniqueSorted(state.products.map((product) => product.category));
  const brands = uniqueSorted(state.products.map((product) => product.brand));

  elements.categorySelect.append(...categories.map(createOption));
  elements.brandSelect.append(...brands.map(createOption));

  elements.categoryChips.innerHTML = categories
    .map((category) => `<button type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join("");

  elements.categoryChips.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    elements.categorySelect.value = state.category;
    renderCatalog();
  });
}

function createOption(value) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  return option;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
}

function updateStats() {
  const categories = new Set(state.products.map((product) => product.category));
  const minPrice = Math.min(...state.products.map((product) => product.price_vnd).filter(Boolean));

  elements.statProducts.textContent = state.products.length;
  elements.statCategories.textContent = categories.size;
  elements.statPrice.textContent = formatPrice(minPrice);
}

function render() {
  if (state.activeProductId) {
    renderProductPage(state.activeProductId);
  } else {
    showCatalog();
    renderCatalog();
  }
}

function renderCatalog() {
  const filtered = getFilteredProducts();
  const activeLabel = state.category || state.brand || (state.search ? "Kết quả tìm kiếm" : "Tất cả sản phẩm");

  showCatalog();
  elements.resultTitle.textContent = activeLabel;
  elements.resultCount.textContent = `${filtered.length} sản phẩm`;
  elements.emptyState.hidden = filtered.length !== 0;
  elements.productGrid.innerHTML = filtered.map(renderCard).join("");

  document.querySelectorAll(".chips button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === state.category);
  });
}

function showCatalog() {
  elements.controlsBand.hidden = false;
  elements.catalogShell.hidden = false;
  elements.productDetail.hidden = true;
}

function getFilteredProducts() {
  const filtered = state.products.filter((product) => {
    const matchesSearch = !state.search || product.searchable.includes(state.search);
    const matchesCategory = !state.category || product.category === state.category;
    const matchesBrand = !state.brand || product.brand === state.brand;
    return matchesSearch && matchesCategory && matchesBrand;
  });

  return filtered.sort((a, b) => {
    if (state.sort === "name-asc") return a.title.localeCompare(b.title, "vi");
    if (state.sort === "price-asc") return a.price_vnd - b.price_vnd;
    if (state.sort === "price-desc") return b.price_vnd - a.price_vnd;
    if (state.sort === "category-asc") return a.category.localeCompare(b.category, "vi") || a.title.localeCompare(b.title, "vi");
    return a.index - b.index;
  });
}

function resetFilters() {
  state.search = "";
  state.category = "";
  state.brand = "";
  state.sort = "featured";

  elements.searchInput.value = "";
  elements.categorySelect.value = "";
  elements.brandSelect.value = "";
  elements.sortSelect.value = "featured";
  renderCatalog();
}

function renderCard(product) {
  const benefits = product.benefits.slice(0, 2).map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join("");
  const imageMarkup = product.primaryImage
    ? `<img src="${escapeAttribute(product.primaryImage)}" alt="Ảnh sản phẩm ${escapeAttribute(product.title)}" loading="lazy">`
    : `<div class="image-placeholder">Chưa có ảnh</div>`;

  return `
    <article class="product-card">
      <a class="product-media product-link" href="${productUrl(product.id)}" data-product-id="${escapeAttribute(product.id)}">
        ${imageMarkup}
      </a>
      <div class="product-body">
        <div class="product-meta">
          <span>${escapeHtml(product.category)}</span>
          <span>${escapeHtml(product.brand)}</span>
        </div>
        <a class="product-title-link" href="${productUrl(product.id)}" data-product-id="${escapeAttribute(product.id)}">
          <h3>${escapeHtml(product.title)}</h3>
        </a>
        <p class="sku">Mã sản phẩm: ${escapeHtml(product.id)}</p>
        <p class="description">${escapeHtml(product.short_description)}</p>
        <p class="price">${escapeHtml(product.price_label)}</p>
        <p class="package">${escapeHtml(product.package_size)}</p>
        <ul class="benefits">${benefits}</ul>
        <a class="detail-button" href="${productUrl(product.id)}" data-product-id="${escapeAttribute(product.id)}">Xem chi tiết</a>
      </div>
    </article>
  `;
}

function renderProductPage(productId) {
  const product = state.products.find((item) => item.id === productId);
  elements.controlsBand.hidden = true;
  elements.catalogShell.hidden = true;
  elements.productDetail.hidden = false;

  if (!product) {
    elements.productDetail.innerHTML = `
      <article class="empty-state">
        <h2>Không tìm thấy sản phẩm</h2>
        <p>Không có sản phẩm với mã ${escapeHtml(productId)} trong CSV.</p>
        <a class="detail-button inline-action" href="./" data-back-to-catalog>Quay lại danh mục</a>
      </article>
    `;
    return;
  }

  const mainImage = product.primaryImage;
  const gallery = product.images.map((image, index) => `
    <button
      class="thumbnail ${index === 0 ? "is-active" : ""}"
      type="button"
      data-gallery-src="${escapeAttribute(image)}"
      data-gallery-alt="Ảnh ${index + 1} của ${escapeAttribute(product.title)}"
      aria-label="Xem ảnh ${index + 1}"
    >
      <img src="${escapeAttribute(image)}" alt="" loading="lazy">
    </button>
  `).join("");

  elements.productDetail.innerHTML = `
    <article class="product-page">
      <a class="back-link" href="./" data-back-to-catalog>← Quay lại danh mục</a>
      <div class="product-page-grid">
        <section class="gallery-panel" aria-label="Ảnh sản phẩm">
          <div class="main-product-image">
            ${
              mainImage
                ? `<img id="detailMainImage" src="${escapeAttribute(mainImage)}" alt="Ảnh sản phẩm ${escapeAttribute(product.title)}">`
                : `<div class="image-placeholder">Chưa có ảnh</div>`
            }
          </div>
          <div class="thumbnail-row">${gallery}</div>
        </section>

        <section class="purchase-panel">
          <p class="eyebrow">${escapeHtml(product.category)}</p>
          <h2>${escapeHtml(product.title)}</h2>
          <p class="sku">Mã sản phẩm: ${escapeHtml(product.id)}</p>
          <p class="dialog-price">${escapeHtml(product.price_label)}</p>
          <p class="description large">${escapeHtml(product.short_description)}</p>

          <dl class="commerce-facts">
            <div>
              <dt>Thương hiệu</dt>
              <dd>${escapeHtml(product.brand)}</dd>
            </div>
            <div>
              <dt>Quy cách</dt>
              <dd>${escapeHtml(product.package_size)}</dd>
            </div>
            <div>
              <dt>Xuất xứ</dt>
              <dd>${escapeHtml(product.origin)}</dd>
            </div>
          </dl>

          <div class="action-row">
            <a class="secondary-button" href="./" data-back-to-catalog>Tiếp tục mua sắm</a>
          </div>
        </section>
      </div>

      <section class="product-info-grid">
        ${renderDetailGroup("Công dụng nổi bật", product.benefits)}
        ${renderDetailGroup("Thành phần chính", product.ingredients)}
        <div class="detail-group">
          <h3>Cách dùng</h3>
          <p>${escapeHtml(product.usage)}</p>
        </div>
        <div class="detail-group">
          <h3>Lưu ý</h3>
          <p>${escapeHtml(product.warning)}</p>
        </div>
      </section>
    </article>
  `;
}

function renderDetailGroup(title, items) {
  if (!items.length) return "";
  return `
    <div class="detail-group">
      <h3>${title}</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function openProductById(productId) {
  state.activeProductId = productId;
  history.pushState({}, "", productUrl(productId));
  renderProductPage(productId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeProductPage() {
  state.activeProductId = "";
  const url = new URL(window.location.href);
  url.searchParams.delete("id");
  history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  renderCatalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function productUrl(productId) {
  return `?id=${encodeURIComponent(productId)}`;
}

function getProductIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function formatPrice(value) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VNĐ`;
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
// ***** Theme Toggle *****
function applyTheme(mode) {
  if (mode === "light") {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }
}

function initTheme() {
  var stored = localStorage.getItem("theme");
  if (stored === "light") {
    applyTheme("light");
  } else if (stored === null) {
    // default is dark, but check system preference
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    if (prefersLight) applyTheme("light");
  }
}

function bindTheme() {
  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function() {
      var isLight = document.body.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
      localStorage.setItem("theme", isLight ? "dark" : "light");
    });
  }
}
