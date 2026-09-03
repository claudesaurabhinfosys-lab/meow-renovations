(function () {
  const API_BASE =
    "https://meow-service-test.flutterclone.com/api/sites/meowrenovations-1785930255/packages";
  const HELPERS_HEAD = "site_17ae9f96c18a0e8a81d0363c3c91a025709fdb7bace738b2";
  const WHATSAPP_NUMBER = "6587713358";
  const PER_PAGE = 6;

  const state = {
    page: 1,
    lastPage: 1,
    total: 0,
    cache: new Map(),
  };

  async function fetchPackagePage(page) {
    if (state.cache.has(page)) return state.cache.get(page);

    try {
      const url = new URL(API_BASE);
      url.searchParams.set("page", page);
      url.searchParams.set("per_page", PER_PAGE);

      const res = await fetch(url.href, {
        headers: {
          "X-Helpers-Secret": HELPERS_HEAD,
          "X-Site-Api-Key": HELPERS_HEAD,
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`Packages fetch failed: ${res.status}`);

      const payload = await res.json();
      const pageData = extractPageData(payload);
      state.cache.set(page, pageData);
      return pageData;
    } catch (err) {
      console.log("PACKAGES GET ERROR /", err);
      return { packages: [], meta: { currentPage: page, lastPage: 1, total: 0 } };
    }
  }

  function extractPageData(payload) {
    const data = payload?.data ?? payload;
    const paginator = data && !Array.isArray(data) ? data : null;
    const packages = extractPackages(data).map(normalizePackage);

    return {
      packages,
      meta: {
        currentPage: Number(paginator?.current_page || state.page || 1),
        lastPage: Number(paginator?.last_page || 1),
        total: Number(paginator?.total || packages.length),
      },
    };
  }

  function extractPackages(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.packages)) return data.packages;
    if (Array.isArray(data?.items)) return data.items;
    if (data && typeof data === "object" && isPackageLike(data)) return [data];
    return [];
  }

  function isPackageLike(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        (value.service_name ||
          value.category_name ||
          value.sub_category_name ||
          value.name ||
          value.title ||
          value.final_price ||
          value.price),
    );
  }

  function firstValue(...values) {
    return values.find(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }

  function normalizePackage(pkg) {
    const packageName =
      pkg.name && pkg.name !== "Request for Quote" ? pkg.name : "";
    const title = firstValue(
      pkg.service_name,
      pkg.serviceName,
      packageName,
      pkg.title,
      pkg.package_name,
      pkg.packageName,
      "Renovation Package",
    );
    const subtitle = [pkg.category_name, pkg.sub_category_name]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join(" / ");
    const price = firstValue(
      pkg.final_price,
      pkg.member_price,
      pkg.discount_price,
      pkg.price,
    );
    const badge = firstValue(
      pkg.badges?.is_top_seller ? "Top Seller" : "",
      pkg.is_trial ? "Trial" : "",
      pkg.badge,
      pkg.label,
      pkg.tag,
    );

    return {
      title,
      subtitle,
      description: cleanDescription(pkg.description),
      price: formatPrice(price),
      currencySymbol: getCurrencySymbol(pkg.currency),
      features: normalizeFeatures(pkg),
      badge,
      order: Number(firstValue(pkg.sort_order, pkg.sortOrder, pkg.order, 999)),
      ctaLabel: firstValue(pkg.cta_label, pkg.ctaLabel, "Request Quote"),
      ctaUrl: normalizeUrl(
        firstValue(pkg.cta_url, pkg.ctaUrl, pkg.url, pkg.link),
      ),
    };
  }

  function formatPrice(value) {
    if (value === undefined || value === null || value === "") return "";

    const numeric = Number(String(value).replace(/[^\d.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      return new Intl.NumberFormat("en-SG", {
        maximumFractionDigits: 0,
      }).format(numeric);
    }

    return "";
  }

  function getCurrencySymbol(currency) {
    if (!currency) return "$";
    const code = String(currency).toUpperCase();
    if (code === "SGD" || code === "USD") return "$";
    return code;
  }

  function normalizeFeatures(pkg) {
    const source = firstValue(
      pkg.included_details,
      pkg.features,
      pkg.inclusions,
      pkg.benefits,
      pkg.points,
      pkg.details,
      pkg.highlight_details,
      pkg.package_items,
      pkg.packageItems,
    );

    let features = [];

    if (Array.isArray(source)) {
      features = source.map((item) =>
        typeof item === "object"
          ? firstValue(item.label, item.title, item.name, item.description, "")
          : item,
      );
    } else if (typeof source === "string") {
      features = source.split(/\n|;|\|/);
    }

    return features.map((item) => String(item).trim()).filter(Boolean);
  }

  function createWhatsappUrl(pkg) {
    const text = `Hi Meow, I'm interested in ${pkg.title}.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  }

  function cleanDescription(value) {
    if (!value) return "";
    return String(value).replace(/\s+/g, " ").trim();
  }

  function normalizeUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(value, window.location.href);
      const allowedProtocols = ["https:", "http:", "mailto:", "tel:"];
      return allowedProtocols.includes(url.protocol) ? url.href : "";
    } catch (err) {
      return "";
    }
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderPackageCard(pkg, index) {
    const absoluteIndex = (state.page - 1) * PER_PAGE + index + 1;
    const badgeHTML = pkg.badge
      ? `<div class="absolute -top-3 left-7 px-3 py-1 rounded-full bg-accent text-ink text-[10px] font-semibold tracking-[.2em] uppercase">${escapeHTML(pkg.badge)}</div>`
      : "";
    const subtitleHTML = pkg.subtitle
      ? `<span class="text-xs uppercase tracking-[.18em] text-stone">${escapeHTML(pkg.subtitle)}</span>`
      : `<span class="text-xs uppercase tracking-[.18em] text-stone">Package</span>`;
    const priceHTML = pkg.price
      ? `<span class="text-stone text-sm">${escapeHTML(pkg.currencySymbol)}</span><span class="num text-4xl tracking-tight">${escapeHTML(pkg.price)}</span>`
      : `<span class="font-display text-3xl">Request Quote</span>`;
    const descriptionHTML = pkg.description
      ? `<p class="package-card__description mt-4 text-sm text-stone leading-relaxed">${escapeHTML(pkg.description)}</p>`
      : "";
    const featuresHTML = pkg.features.length
      ? `<ul class="mt-6 space-y-2.5 text-sm text-ink/80">
          ${pkg.features
            .slice(0, 5)
            .map(
              (feature) =>
                `<li class="flex gap-2"><span class="text-clay">·</span> ${escapeHTML(feature)}</li>`,
            )
            .join("")}
        </ul>`
      : "";
    const ctaUrl = pkg.ctaUrl || createWhatsappUrl(pkg);

    return `
      <div class="price-card bg-bone rounded-3xl p-7 border border-softgrey relative reveal in">
        ${badgeHTML}
        <div class="flex items-center justify-between gap-4">
          ${subtitleHTML}
          <span class="num text-clay">${String(absoluteIndex).padStart(2, "0")}</span>
        </div>
        <h4 class="font-display text-2xl mt-4 leading-tight">${escapeHTML(pkg.title)}</h4>
        <div class="mt-5 flex items-baseline gap-1">${priceHTML}</div>
        ${descriptionHTML}
        ${featuresHTML}
        <a href="${escapeHTML(ctaUrl)}" class="mt-7 inline-flex items-center gap-2 text-sm font-medium ulink">${escapeHTML(pkg.ctaLabel)} →</a>
      </div>
    `;
  }

  function renderPagination() {
    const pagination = document.getElementById("packages-pagination");
    if (!pagination) return;

    if (state.lastPage <= 1) {
      pagination.classList.add("hidden");
      pagination.innerHTML = "";
      return;
    }

    const pageButtons = Array.from({ length: state.lastPage }, (_, index) => {
      const page = index + 1;
      const active = page === state.page;
      const classes = active
        ? "bg-ink text-bone border-ink"
        : "bg-bone text-ink border-softgrey hover:border-ink/30";
      return `<button type="button" data-package-page="${page}" class="min-w-10 h-10 px-3 rounded-full border text-sm font-medium transition ${classes}" aria-current="${active ? "page" : "false"}">${page}</button>`;
    }).join("");

    pagination.innerHTML = `
      <button type="button" data-package-page="${state.page - 1}" class="h-10 px-4 rounded-full border border-softgrey bg-bone text-sm font-medium text-ink disabled:opacity-40" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
      ${pageButtons}
      <button type="button" data-package-page="${state.page + 1}" class="h-10 px-4 rounded-full border border-softgrey bg-bone text-sm font-medium text-ink disabled:opacity-40" ${state.page >= state.lastPage ? "disabled" : ""}>Next</button>
    `;
    pagination.classList.remove("hidden");
  }

  async function loadPage(page) {
    const grid = document.getElementById("package-list");
    const loading = document.getElementById("packages-loading");
    const empty = document.getElementById("packages-empty");
    if (!grid) return;

    state.page = Math.max(1, page);
    if (loading) {
      loading.hidden = false;
      loading.textContent = "Loading packages...";
    }
    if (empty) empty.classList.add("hidden");

    const { packages, meta } = await fetchPackagePage(state.page);
    state.page = meta.currentPage;
    state.lastPage = meta.lastPage;
    state.total = meta.total;
    if (loading) loading.hidden = true;

    if (packages.length === 0) {
      grid.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      renderPagination();
      return;
    }

    grid.innerHTML = [...packages]
      .sort((a, b) => a.order - b.order)
      .map(renderPackageCard)
      .join("");
    renderPagination();
  }

  function bindPagination() {
    const pagination = document.getElementById("packages-pagination");
    if (!pagination) return;

    pagination.addEventListener("click", (event) => {
      const button = event.target.closest("[data-package-page]");
      if (!button || button.disabled) return;

      const page = Number(button.dataset.packagePage);
      if (!Number.isFinite(page) || page === state.page) return;

      loadPage(page);
      document.getElementById("pricing")?.scrollIntoView({ block: "start" });
    });
  }

  function initPricingSection() {
    bindPagination();
    loadPage(1);
  }

  window.initPricingSection = initPricingSection;
})();
