import {
  LISTING_PLATFORM_KEYS,
  STORE_INVENTORIES,
  STORE_LISTING_SUMMARIES,
  STORE_LISTINGS,
  STORE_PLATFORM_LISTING_LINKS,
  STORE_PRODUCTS,
  STORE_RAW_IMPORTS,
} from "./constants.js";
import { parseCsvText } from "./csv.js";

const HEADER_ALIASES = {
  platform: [
    "\u30d7\u30e9\u30c3\u30c8\u30d5\u30a9\u30fc\u30e0",
    "\u51fa\u54c1\u30b5\u30a4\u30c8",
    "platform",
    "site",
    "marketplace",
  ],
  inventoryManagementId: [
    "\u5728\u5eab\u7ba1\u7406ID",
    "\u5728\u5eab\u7ba1\u7406id",
    "\u7ba1\u7406ID",
    "SKU",
    "sku",
  ],
  platformItemId: [
    "\u5546\u54c1ID",
    "platformItemId",
    "itemId",
    "item_id",
    "auctionId",
    "auction_id",
    "\u30aa\u30fc\u30af\u30b7\u30e7\u30f3ID",
    "id",
  ],
  title: ["\u5546\u54c1\u540d", "\u30bf\u30a4\u30c8\u30eb", "title", "name"],
  price: [
    "\u4fa1\u683c",
    "\u8ca9\u58f2\u4fa1\u683c",
    "price",
    "currentPrice",
    "buyNowPrice",
    "\u73fe\u5728\u4fa1\u683c",
    "\u5373\u6c7a\u4fa1\u683c",
  ],
  status: [
    "\u30b9\u30c6\u30fc\u30bf\u30b9",
    "status",
    "listingType",
    "timeLeft",
    "\u51fa\u54c1\u72b6\u6cc1",
    "\u53d6\u5f15\u72b6\u6cc1",
  ],
  itemUrl: ["\u5546\u54c1URL", "itemUrl", "item_url", "URL", "url"],
  editUrl: ["\u7de8\u96c6URL", "editUrl", "edit_url", "\u7ba1\u7406URL"],
  imageUrl: [
    "\u753b\u50cfURL",
    "imageUrl",
    "image_url",
    "thumbnailUrl",
    "thumbnail_url",
    "\u30b5\u30e0\u30cd\u30a4\u30ebURL",
  ],
  visibleText: ["visibleText", "visible_text", "\u8868\u793a\u30c6\u30ad\u30b9\u30c8"],
  condition: ["\u5546\u54c1\u306e\u72b6\u614b", "\u72b6\u614b", "condition"],
};

export class ListingImportService {
  constructor({ database, productRepository, importRepository, listingRepository = null }) {
    this.database = database;
    this.productRepository = productRepository;
    this.importRepository = importRepository;
    this.listingRepository = listingRepository;
  }

  async importCsv({ fileName, csvText, platformHint = "" }) {
    const parsed = parseCsvText(csvText);
    if (parsed.headers.length === 0) {
      throw new Error("CSV\u306b\u6709\u52b9\u306a\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093");
    }

    if (isProductExportCsv(parsed.headers)) {
      if (parsed.rows.length === 0) {
        throw new Error("\u30c4\u30fc\u30eb\u66f8\u304d\u51fa\u3057CSV\u306b\u30c7\u30fc\u30bf\u884c\u304c\u3042\u308a\u307e\u305b\u3093");
      }

      const importedProducts = parsed.rows.map(normalizeProductExportRow);
      if (!this.database) {
        throw new Error("CSV取込用データベースが設定されていません");
      }
      await this.database.runTransaction(
        [STORE_PRODUCTS, STORE_LISTINGS, STORE_INVENTORIES],
        "readwrite",
        (stores) => {
          importedProducts.forEach((product) => {
            stores[STORE_PRODUCTS].put(buildProductMasterRecord(product));
            stores[STORE_LISTINGS].put(buildListingRecordFromProductExport(product));
            stores[STORE_INVENTORIES].put(buildInventoryRecordFromProductExport(product));
          });
        },
      );
      return {
        importId: "",
        platform: "product-export",
        importedAt: new Date().toISOString(),
        totalRows: parsed.rows.length,
        importedProducts: importedProducts.length,
        warnings: [],
      };
    }

    if (parsed.rows.length === 0) {
      throw new Error("CSV\u306b\u6709\u52b9\u306a\u30c7\u30fc\u30bf\u884c\u304c\u3042\u308a\u307e\u305b\u3093");
    }

    const importedAt = new Date().toISOString();
    const platform = detectPlatform(parsed.headers, parsed.rows, platformHint);
    const importId = crypto.randomUUID();

    const rawImport = {
      importId,
      platform,
      sourceCsvType: "listing-summary",
      fileName: fileName || "import.csv",
      importedAt,
      rowCount: parsed.rows.length,
      headers: parsed.headers,
      rawRows: parsed.rows,
    };

    const existingProducts = await this.productRepository.getAll();
    const listingSummaries = [];
    const listings = [];
    const platformListingLinks = [];
    const warnings = [];

    for (const [index, rawRow] of parsed.rows.entries()) {
      const normalized = normalizeListingRow(rawRow, platform);
      const rowPlatform = normalized.platform || platform;
      if (!normalized.platformItemId && !normalized.title) {
        warnings.push(`\u884c ${index + 2}: \u5546\u54c1ID\u3068\u30bf\u30a4\u30c8\u30eb\u304c\u7a7a\u306e\u305f\u3081\u30b9\u30ad\u30c3\u30d7\u3057\u307e\u3057\u305f`);
        continue;
      }

      const summaryId = `${rowPlatform || "unknown"}:${normalized.platformItemId || crypto.randomUUID()}`;
      const summary = {
        summaryId,
        importId,
        importedAt,
        platform: rowPlatform,
        inventoryManagementId: normalized.inventoryManagementId,
        platformItemId: normalized.platformItemId,
        title: normalized.title,
        price: normalized.price,
        status: normalized.status,
        itemUrl: normalized.itemUrl,
        editUrl: normalized.editUrl,
        imageUrl: normalized.imageUrl,
        condition: normalized.condition,
        sourceCsvType: "listing-summary",
        platformSpecific: normalized.platformSpecific,
      };

      listingSummaries.push(summary);

      if (normalized.inventoryManagementId && normalized.platformItemId) {
        const platformItemKey = buildPlatformItemKey(rowPlatform, normalized.platformItemId);
        platformListingLinks.push({
          linkId: buildPlatformListingLinkId(
            normalized.inventoryManagementId,
            rowPlatform,
            normalized.platformItemId,
          ),
          inventoryManagementId: normalized.inventoryManagementId,
          platform: rowPlatform,
          platformItemId: normalized.platformItemId,
          platformItemKey,
          summaryId,
          linkedAt: importedAt,
        });
      } else if (normalized.inventoryManagementId && !normalized.platformItemId) {
        warnings.push(`行 ${index + 2}: 商品IDが空のため、出品リンク情報は作成しませんでした`);
      }
    }

    const mergedProducts = [];
    const knownProducts = [...existingProducts];

    listingSummaries.forEach((summary, index) => {
      const match = resolveProductMatch(knownProducts, summary);
      if (match.warning) {
        warnings.push(`行 ${index + 2}: ${match.warning}`);
      }

      const mergedProduct = buildProductFromSummary(summary, match.existing, { autoMatch: match.mode === "exact" });
      mergedProducts.push(mergedProduct);
      listings.push(buildListingRecord(summary, mergedProduct, match.mode));

      const knownIndex = knownProducts.findIndex((product) => product.id === mergedProduct.id);
      if (knownIndex >= 0) {
        knownProducts[knownIndex] = mergedProduct;
      } else {
        knownProducts.push(mergedProduct);
      }
    });

    if (!this.database) {
      throw new Error("CSV取込用データベースが設定されていません");
    }

    const storeNames = [
      STORE_RAW_IMPORTS,
      STORE_LISTING_SUMMARIES,
      STORE_PLATFORM_LISTING_LINKS,
      STORE_PRODUCTS,
      ...(this.listingRepository ? [STORE_LISTINGS] : []),
    ];

    await this.database.runTransaction(storeNames, "readwrite", (stores) => {
      stores[STORE_RAW_IMPORTS].put(rawImport);
      listingSummaries.forEach((summary) => stores[STORE_LISTING_SUMMARIES].put(summary));
      platformListingLinks.forEach((link) => stores[STORE_PLATFORM_LISTING_LINKS].put(link));
      mergedProducts.forEach((product) => stores[STORE_PRODUCTS].put(buildProductMasterRecord(product)));
      if (stores[STORE_LISTINGS]) {
        listings.forEach((listing) => stores[STORE_LISTINGS].put(listing));
      }
    });

    return {
      importId,
      platform,
      importedAt,
      totalRows: parsed.rows.length,
      importedProducts: mergedProducts.length,
      warnings,
    };
  }
}

function detectPlatform(headers, rows, platformHint) {
  const hint = String(platformHint || "").trim();
  if (hint.includes(LISTING_PLATFORM_KEYS.mercari)) return LISTING_PLATFORM_KEYS.mercari;
  if (hint.includes(LISTING_PLATFORM_KEYS.yahoo)) return LISTING_PLATFORM_KEYS.yahoo;

  const headerSet = new Set(headers.map((header) => String(header || "").toLowerCase()));
  if (
    headerSet.has("listingtype") ||
    headerSet.has("currentprice") ||
    headerSet.has("buynowprice") ||
    headerSet.has("watchcount")
  ) {
    return LISTING_PLATFORM_KEYS.yahoo;
  }

  const combined = [
    headers.join(" "),
    ...rows.slice(0, 3).map((row) => Object.values(row).join(" ")),
  ].join(" ");

  if (combined.includes(LISTING_PLATFORM_KEYS.mercari) || combined.toLowerCase().includes("mercari")) {
    return LISTING_PLATFORM_KEYS.mercari;
  }

  if (
    combined.includes(LISTING_PLATFORM_KEYS.yahoo) ||
    combined.includes("auctions.yahoo.co.jp") ||
    combined.toLowerCase().includes("auction")
  ) {
    return LISTING_PLATFORM_KEYS.yahoo;
  }

  return "";
}

function detectPlatformFromValues(values) {
  const combined = values
    .filter(Boolean)
    .map((value) => String(value))
    .join(" ");

  if (!combined) return "";
  if (
    combined.includes(LISTING_PLATFORM_KEYS.mercari) ||
    combined.toLowerCase().includes("mercari") ||
    combined.includes("jp.mercari.com") ||
    combined.includes("mercdn.net") ||
    /(?:\/item\/|items\/)(m[0-9a-z]+)/i.test(combined)
  ) {
    return LISTING_PLATFORM_KEYS.mercari;
  }
  if (combined.includes("mercari.com") || /(?:\/item\/|items\/)(m[0-9a-z]+)/i.test(combined)) {
    return LISTING_PLATFORM_KEYS.mercari;
  }
  if (
    combined.includes(LISTING_PLATFORM_KEYS.yahoo) ||
    combined.toLowerCase().includes("yahoo") ||
    combined.includes("auctions.yahoo.co.jp") ||
    /(?:aID=|\/auction\/)([a-z]\d+)/i.test(combined)
  ) {
    return LISTING_PLATFORM_KEYS.yahoo;
  }

  return "";
}

function normalizeListingRow(row, platform) {
  const explicitPlatform = normalizePlatformValue(readByAliases(row, HEADER_ALIASES.platform));
  const inventoryManagementId = readByAliases(row, HEADER_ALIASES.inventoryManagementId);
  const itemUrl = readByAliases(row, HEADER_ALIASES.itemUrl);
  const editUrl = readByAliases(row, HEADER_ALIASES.editUrl);
  const imageUrl = readByAliases(row, HEADER_ALIASES.imageUrl);
  const visibleText = readByAliases(row, HEADER_ALIASES.visibleText);
  const resolvedPlatform =
    explicitPlatform ||
    detectPlatformFromValues([
      itemUrl,
      editUrl,
      imageUrl,
      visibleText,
      readByAliases(row, HEADER_ALIASES.platformItemId),
      ...Object.values(row),
    ]) ||
    platform;
  const platformItemId =
    readByAliases(row, HEADER_ALIASES.platformItemId) ||
    extractPlatformItemId(resolvedPlatform, itemUrl, editUrl);

  const knownHeaders = new Set(Object.values(HEADER_ALIASES).flat());
  const platformSpecific = {};
  Object.entries(row).forEach(([key, value]) => {
    if (!knownHeaders.has(key) && value !== "") {
      platformSpecific[key] = value;
    }
  });

  return {
    platform: resolvedPlatform,
    inventoryManagementId,
    platformItemId,
    title: sanitizeImportedListingTitleV3(readByAliases(row, HEADER_ALIASES.title), visibleText),
    price: parsePrice(readByAliases(row, HEADER_ALIASES.price) || extractMercariPriceFromVisibleTextV3(visibleText)),
    status: readByAliases(row, HEADER_ALIASES.status) || extractMercariStatusFromVisibleTextV3(visibleText),
    itemUrl,
    editUrl,
    imageUrl,
    condition: readByAliases(row, HEADER_ALIASES.condition),
    platformSpecific,
  };
}

function normalizePlatformValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (
    normalized.includes(LISTING_PLATFORM_KEYS.mercari) ||
    normalized.toLowerCase().includes("mercari")
  ) {
    return LISTING_PLATFORM_KEYS.mercari;
  }
  if (
    normalized.includes(LISTING_PLATFORM_KEYS.yahoo) ||
    normalized.toLowerCase().includes("yahoo")
  ) {
    return LISTING_PLATFORM_KEYS.yahoo;
  }
  return normalized;
}

function readByAliases(row, aliases) {
  for (const alias of aliases) {
    if (row[alias]) return String(row[alias]).trim();

    const matchedKey = Object.keys(row).find((key) => key.toLowerCase() === alias.toLowerCase());
    if (matchedKey && row[matchedKey]) {
      return String(row[matchedKey]).trim();
    }
  }
  return "";
}

function parsePrice(value) {
  const numeric = String(value || "").replace(/[^\d.-]/g, "");
  return numeric ? Number(numeric) || 0 : 0;
}

function sanitizeImportedListingTitle(title, visibleText = "") {
  const directTitle = normalizeImportedTitleCandidate(title);
  if (directTitle) return directTitle;

  const candidates = String(visibleText || "")
    .split("/")
    .map((value) => normalizeImportedTitleCandidate(value))
    .filter(Boolean);

  return candidates[0] || "";
}

function sanitizeImportedListingTitleV2(title, visibleText = "") {
  const directTitle = normalizeImportedTitleCandidateV2(title);
  if (directTitle) return directTitle;

  const candidates = String(visibleText || "")
    .split("/")
    .map((value) => normalizeImportedTitleCandidateV2(value))
    .filter(Boolean);

  return candidates[0] || "";
}

function normalizeImportedTitleCandidateV2(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/^[¥￥]\s*[\d,]+$/.test(normalized) || /^\d[\d,]*円$/.test(normalized)) return "";
  if (/^(再出品|削除|コメント|コメ削|編集|停止)$/.test(normalized)) return "";
  if (/^(公開中|取引中|売り切れ)$/.test(normalized)) return "";
  if (/(時間前に出品|日前に出品)/.test(normalized)) return "";

  return normalized
    .replace(/のサムネイル.*$/u, "")
    .replace(/\bundefined\b/gi, "")
    .trim();
}

function extractMercariPriceFromVisibleTextV2(visibleText) {
  const normalized = String(visibleText || "").trim();
  const match = normalized.match(/[¥￥]\s*([\d,]+)/);
  return match?.[1] || "";
}

function extractMercariStatusFromVisibleTextV2(visibleText) {
  const normalized = String(visibleText || "").trim();
  const match = normalized.match(/(時間前に出品|日前に出品|公開中|取引中|売り切れ)/);
  return match?.[1] || "";
}

function normalizeImportedTitleCandidate(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/^[\u00A5\uFFE5]\s*[\d,]+$/.test(normalized) || /^\d[\d,]*\u5186$/.test(normalized)) return "";
  if (/^(\u518D\u51FA\u54C1|\u524A\u9664|\u30B3\u30E1\u30F3\u30C8|\u30B3\u30E1\u524A|\u7DE8\u96C6|\u505C\u6B62)$/.test(normalized)) return "";
  if (/^(\u516C\u958B\u4E2D|\u53D6\u5F15\u4E2D|\u58F2\u308A\u5207\u308C)$/.test(normalized)) return "";
  if (/(\d+\s*(?:\u6642\u9593\u524D\u306B\u51FA\u54C1|\u65E5\u524D\u306B\u51FA\u54C1))/.test(normalized)) return "";

  return normalized
    .replace(/\u306E\u30B5\u30E0\u30CD\u30A4\u30EB.*$/u, "")
    .replace(/\bundefined\b/gi, "")
    .trim();
}

function extractMercariPriceFromVisibleText(visibleText) {
  const normalized = String(visibleText || "").trim();
  const match = normalized.match(/[\u00A5\uFFE5]\s*(?:\/\s*)?([\d,]+)/);
  return match?.[1] || "";
}

function extractMercariStatusFromVisibleText(visibleText) {
  const normalized = String(visibleText || "").trim();
  const match = normalized.match(
    /(\d+\s*(?:\u6642\u9593\u524D\u306B\u51FA\u54C1|\u65E5\u524D\u306B\u51FA\u54C1)|\u516C\u958B\u4E2D|\u53D6\u5F15\u4E2D|\u58F2\u308A\u5207\u308C)/
  );
  return match?.[1] || "";
}

function sanitizeImportedListingTitleV3(title, visibleText = "") {
  const directTitle = normalizeImportedTitleCandidateV3(title);
  if (directTitle) return directTitle;

  const candidates = String(visibleText || "")
    .split("/")
    .map((value) => normalizeImportedTitleCandidateV3(value))
    .filter(Boolean);

  return candidates[0] || "";
}

function normalizeImportedTitleCandidateV3(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/^[\u00A5\uFFE5]\s*[\d,]+$/.test(normalized) || /^\d[\d,]*\u5186$/.test(normalized)) return "";
  if (/^(\u518D\u51FA\u54C1|\u524A\u9664|\u30B3\u30E1\u30F3\u30C8|\u30B3\u30E1\u524A|\u7DE8\u96C6|\u505C\u6B62)$/.test(normalized)) return "";
  if (/^(\u516C\u958B\u4E2D|\u53D6\u5F15\u4E2D|\u58F2\u308A\u5207\u308C)$/.test(normalized)) return "";
  if (/(\d+\s*(?:\u6642\u9593\u524D\u306B\u51FA\u54C1|\u65E5\u524D\u306B\u51FA\u54C1))/.test(normalized)) return "";

  return normalized
    .replace(/\u306E\u30B5\u30E0\u30CD\u30A4\u30EB.*$/u, "")
    .replace(/\bundefined\b/gi, "")
    .trim();
}

function extractMercariPriceFromVisibleTextV3(visibleText) {
  const segments = String(visibleText || "")
    .split("/")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const yenIndex = segments.findIndex((value) => value === "\u00A5" || value === "\uFFE5" || value === "¥" || value === "￥");
  if (yenIndex >= 0 && /^\d[\d,]*$/.test(segments[yenIndex + 1] || "")) {
    return segments[yenIndex + 1];
  }
  return segments.find((value) => /^\d[\d,]*$/.test(value)) || "";
}

function extractMercariStatusFromVisibleTextV3(visibleText) {
  const segments = String(visibleText || "")
    .split("/")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return (
    segments.find((value) =>
      /^(\d+\s*(?:\u6642\u9593\u524D\u306B\u51FA\u54C1|\u65E5\u524D\u306B\u51FA\u54C1)|\u516C\u958B\u4E2D|\u53D6\u5F15\u4E2D|\u58F2\u308A\u5207\u308C)$/.test(
        value
      )
    ) || ""
  );
}

function extractPlatformItemId(platform, ...values) {
  const merged = values.filter(Boolean).join(" ");
  if (!merged) return "";

  if (platform === LISTING_PLATFORM_KEYS.yahoo) {
    return merged.match(/(?:aID=|\/auction\/)([a-z]\d+)/i)?.[1] || "";
  }

  if (platform === LISTING_PLATFORM_KEYS.mercari) {
    return merged.match(/(?:\/item\/|items\/)(m[0-9a-z]+)/i)?.[1] || "";
  }

  return "";
}

function resolveProductMatch(products, summary) {
  const exactPlatformMatch = findByPlatformItemKey(products, summary);
  if (exactPlatformMatch) {
    return {
      mode: "exact",
      existing: exactPlatformMatch,
      warning: "",
    };
  }

  const skuCandidate = findByInventoryManagementId(products, summary);
  if (skuCandidate) {
    return {
      mode: "candidate",
      existing: null,
      warning: `SKU一致候補を検出しました。自動統合せず新規レコードとして保持しました (SKU: ${summary.inventoryManagementId})`,
    };
  }

  const titlePriceCandidate = findByTitleAndPrice(products, summary);
  if (titlePriceCandidate) {
    return {
      mode: "candidate",
      existing: null,
      warning: `商品名と価格の一致候補を検出しました。自動統合せず新規レコードとして保持しました (${summary.title || "商品名なし"})`,
    };
  }

  return {
    mode: "new",
    existing: null,
    warning: "",
  };
}

function findByPlatformItemKey(products, summary) {
  const platformItemKey = buildPlatformItemKey(summary.platform, summary.platformItemId);
  if (!platformItemKey) return null;
  return (
    products.find((product) => {
      if (product.platformItemKey === platformItemKey) return true;
      return Object.entries(product.externalData || {}).some(([platform, entry]) => (
        buildPlatformItemKey(platform, entry?.platformItemId) === platformItemKey
      ));
    }) || null
  );
}

function findByInventoryManagementId(products, summary) {
  const inventoryManagementId = String(summary.inventoryManagementId || "").trim();
  if (!inventoryManagementId) return null;
  return (
    products.find((product) => String(product.inventoryManagementId || "").trim() === inventoryManagementId) || null
  );
}

function findByTitleAndPrice(products, summary) {
  const normalizedTitle = normalizeComparableText(summary.title);
  if (!normalizedTitle || !summary.price) return null;

  return (
    products.find((product) => {
      const importedPrices = Object.values(product.externalData || {})
        .map((entry) => Number(entry?.price || 0))
        .filter((price) => price > 0);
      return (
        normalizeComparableText(product.title) === normalizedTitle &&
        (Number(product.price || 0) === Number(summary.price || 0) || importedPrices.includes(Number(summary.price || 0)))
      );
    }) || null
  );
}

function buildProductFromSummary(summary, existing, { autoMatch = false } = {}) {
  if (!autoMatch) {
    return buildProductShellFromSummary(summary, existing);
  }

  const now = new Date().toISOString();
  const platformItemKey = buildPlatformItemKey(summary.platform, summary.platformItemId);
  const photos = summary.imageUrl ? [summary.imageUrl] : Array.isArray(existing?.photos) ? existing.photos : [];

  return {
    id: autoMatch && existing?.id ? existing.id : summary.summaryId,
    sku: existing?.sku || summary.inventoryManagementId || summary.platformItemId || "",
    title: summary.title || existing?.title || "",
    brand: existing?.brand || "",
    category: existing?.category || "",
    condition: summary.condition || existing?.condition || "\u76ee\u7acb\u3063\u305f\u50b7\u3084\u6c5a\u308c\u306a\u3057",
    storage: existing?.storage || "",
    price: summary.price || existing?.price || 0,
    platform: summary.platform || existing?.platform || "",
    stock: Number(existing?.stock || 1),
    shipping: existing?.shipping || "",
    shippingSize: existing?.shippingSize || "",
    tags: Array.isArray(existing?.tags) ? existing.tags : [],
    description: existing?.description || "",
    memo: existing?.memo || "",
    photos,
    inventoryManagementId: summary.inventoryManagementId || existing?.inventoryManagementId || "",
    platformItemId: summary.platformItemId || existing?.platformItemId || "",
    platformItemKey,
    itemUrl: summary.itemUrl || existing?.itemUrl || "",
    editUrl: summary.editUrl || existing?.editUrl || "",
    listingStatus: summary.status || existing?.listingStatus || "",
    latestImportId: summary.importId,
    latestImportAt: summary.importedAt,
    externalData: {
      ...(existing?.externalData || {}),
      [summary.platform || "unknown"]: {
        summaryId: summary.summaryId,
        platformItemId: summary.platformItemId,
        itemUrl: summary.itemUrl,
        editUrl: summary.editUrl,
        imageUrl: summary.imageUrl,
        status: summary.status,
        title: summary.title,
        price: Number(summary.price || 0),
        condition: summary.condition || "",
        platformSpecific: summary.platformSpecific,
      },
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function buildProductShellFromSummary(summary, existing) {
  const now = new Date().toISOString();
  const summaryId = summary.summaryId || crypto.randomUUID();
  const platformItemKey = buildPlatformItemKey(summary.platform, summary.platformItemId);
  const fallbackPhotos = summary.imageUrl ? [summary.imageUrl] : [];

  return {
    id: existing?.id || summaryId,
    sku: existing?.sku || summary.inventoryManagementId || summary.platformItemId || "",
    title: summary.title || existing?.title || "",
    brand: existing?.brand || "",
    category: existing?.category || "",
    condition: summary.condition || existing?.condition || "目立った傷や汚れなし",
    storage: existing?.storage || "",
    price: Number(summary.price || existing?.price || 0),
    platform: summary.platform || existing?.platform || "",
    stock: Number(existing?.stock || 1),
    shipping: existing?.shipping || "",
    shippingSize: existing?.shippingSize || "",
    tags: Array.isArray(existing?.tags) ? existing.tags : [],
    description: existing?.description || "",
    memo: existing?.memo || "",
    photos: Array.isArray(existing?.photos) && existing.photos.length > 0 ? existing.photos : fallbackPhotos,
    inventoryManagementId: summary.inventoryManagementId || existing?.inventoryManagementId || "",
    platformItemId: summary.platformItemId || existing?.platformItemId || "",
    platformItemKey,
    itemUrl: summary.itemUrl || existing?.itemUrl || "",
    editUrl: summary.editUrl || existing?.editUrl || "",
    listingStatus: summary.status || existing?.listingStatus || "",
    latestImportId: summary.importId,
    latestImportAt: summary.importedAt,
    externalData: {
      ...(existing?.externalData || {}),
      [summary.platform || "unknown"]: {
        summaryId,
        platformItemId: summary.platformItemId,
        itemUrl: summary.itemUrl,
        editUrl: summary.editUrl,
        imageUrl: summary.imageUrl,
        status: summary.status,
        title: summary.title,
        price: Number(summary.price || 0),
        condition: summary.condition || "",
        platformSpecific: summary.platformSpecific,
      },
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function buildPlatformItemKey(platform, platformItemId) {
  if (!String(platformItemId || "").trim()) return "";
  return `${platform || "unknown"}:${platformItemId || ""}`;
}

function buildPlatformListingLinkId(inventoryManagementId, platform, platformItemId) {
  const inventoryKey = String(inventoryManagementId || "").trim() || "unlinked";
  return `${inventoryKey}:${buildPlatformItemKey(platform, platformItemId)}`;
}

function isProductExportCsv(headers) {
  const headerSet = new Set(headers.map((header) => String(header || "").trim().toLowerCase()));
  return ["id", "sku", "title", "price", "updatedat"].every((header) => headerSet.has(header));
}

function normalizeProductExportRow(row) {
  const now = new Date().toISOString();
  return {
    id: readValue(row, "id") || crypto.randomUUID(),
    sku: readValue(row, "sku"),
    title: readValue(row, "title"),
    brand: readValue(row, "brand"),
    category: readValue(row, "category"),
    condition: readValue(row, "condition") || "\u76ee\u7acb\u3063\u305f\u50b7\u3084\u6c5a\u308c\u306a\u3057",
    storage: readValue(row, "storage"),
    price: parsePrice(readValue(row, "price")),
    platform: normalizePlatformValue(readValue(row, "platform")),
    stock: parseInteger(readValue(row, "stock"), 0),
    shipping: readValue(row, "shipping"),
    shippingSize: readValue(row, "shippingSize"),
    tags: splitPipeSeparatedValue(readValue(row, "tags")),
    description: readValue(row, "description"),
    memo: readValue(row, "memo"),
    photos: [],
    inventoryManagementId: readValue(row, "inventoryManagementId"),
    platformItemId: readValue(row, "platformItemId"),
    platformItemKey: readValue(row, "platformItemKey"),
    itemUrl: readValue(row, "itemUrl"),
    editUrl: readValue(row, "editUrl"),
    listingStatus: readValue(row, "listingStatus"),
    latestImportId: readValue(row, "latestImportId"),
    latestImportAt: readValue(row, "latestImportAt"),
    externalData: {},
    createdAt: readValue(row, "createdAt") || now,
    updatedAt: readValue(row, "updatedAt") || now,
  };
}

function buildProductMasterRecord(product) {
  return {
    id: product.id,
    sku: product.sku || "",
    title: product.title || "",
    photos: Array.isArray(product.photos) ? [...product.photos] : [],
    tags: Array.isArray(product.tags) ? [...product.tags] : [],
    inventoryManagementId: product.inventoryManagementId || "",
    externalData: product.externalData && typeof product.externalData === "object" ? { ...product.externalData } : {},
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function buildListingRecordFromProductExport(product) {
  return {
    lid: `product:${product.id}:primary`,
    pid: product.id,
    platform: product.platform || "",
    platformListingId: product.platformItemId || "",
    platformUrl: product.itemUrl || "",
    editUrl: product.editUrl || "",
    imageUrl: product.photos?.[0] || "",
    brand: product.brand || "",
    category: product.category || "",
    description: product.description || "",
    condition: product.condition || "",
    price: Number(product.price || 0),
    importedAt: product.latestImportAt || product.createdAt || new Date().toISOString(),
    importSource: "product-export",
    linkState: "confirmed",
    listingStatus: product.listingStatus || "",
    shipping: product.shipping || "",
    shippingSize: product.shippingSize || "",
    tags: Array.isArray(product.tags) ? [...product.tags] : [],
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function buildInventoryRecordFromProductExport(product) {
  return {
    iid: `product:${product.id}:primary`,
    pid: product.id,
    shelfCode: product.storage || "",
    linkMemo: product.memo || "",
    checkedAt: product.updatedAt || product.createdAt || new Date().toISOString(),
    inputDevice: "csv-product-export",
    stock: Number(product.stock || 0),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function readValue(row, key) {
  return String(row[key] ?? "").trim();
}

function splitPipeSeparatedValue(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fallback = 0) {
  const numeric = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function buildListingRecord(summary, product, matchMode) {
  return {
    lid: `summary:${summary.summaryId}`,
    pid: matchMode === "exact" ? product.id : "",
    platform: summary.platform || "",
    platformListingId: summary.platformItemId || "",
    platformUrl: summary.itemUrl || "",
    imageUrl: summary.imageUrl || "",
    brand: product.brand || "",
    category: product.category || "",
    description: product.description || "",
    condition: summary.condition || product.condition || "",
    price: Number(summary.price || product.price || 0),
    importedAt: summary.importedAt || new Date().toISOString(),
    importSource: summary.sourceCsvType || "listing-summary",
    linkState: matchMode,
    listingStatus: summary.status || "",
    shipping: product.shipping || "",
    shippingSize: product.shippingSize || "",
    tags: Array.isArray(product.tags) ? [...product.tags] : [],
    updatedAt: summary.importedAt || new Date().toISOString(),
  };
}
