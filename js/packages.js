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
      return {
        packages: [],
        meta: { currentPage: page, lastPage: 1, total: 0 },
      };
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
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Meow, I'm interested in ${pkg.title}.`)}`;

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
        <div class="mt-7 space-y-4">
        <div >
        <p class="text-[11px] font-semibold uppercase tracking-[.15em] text-stone mb-2.5">Questions? Contact us</p>
        <a href="${escapeHTML(whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="w-full h-10 flex items-center justify-center gap-2 text-xs font-medium rounded-lg border hover:bg-[#20BD5A]  hover:text-white transition">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.05 4.91A10 10 0 0 0 4.9 19.06L4 23l4.07-1.06A10 10 0 1 0 19.05 4.91Zm-7.05 16a8 8 0 0 1-4.07-1.12l-.29-.17-2.4.63.64-2.34-.19-.3A8 8 0 1 1 12 20.91Zm4.4-5.96c-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.36.1-.48.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/>
        </svg>
        WhatsApp
        </a>
        </div>
         <div class="border-t border-softgrey pt-4">
          <p class="text-[11px] font-semibold uppercase tracking-[.15em] text-stone mb-2.5">Book an appointment on Le Meow app</p>
          <div class="flex gap-2">
            <a href="https://apps.apple.com/my/app/le-meow/id6763483119" target="_blank" rel="noopener noreferrer" class="flex-1 h-10 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg bg-gray-500 text-white hover:bg-gray-600 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              App Store
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.meow.lemeow" target="_blank" rel="noopener noreferrer" class="flex-1 h-10 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg bg-gray-500 text-white hover:bg-gray-600 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.5 12.92 20.16 13.19L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/>
              </svg>
              Google Play
            </a>
          </div>
        </div>
        </div>
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
