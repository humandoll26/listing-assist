const DB_NAME = "listing-assist-mvp";
const DB_VERSION = 1;
const STORE_PRODUCTS = "products";
const MERCARI_PAYLOAD_PREFIX = "LISTING_ASSIST_MERCARI_PAYLOAD::";
const MERCARI_SELL_URL = "https://jp.mercari.com/sell/create";
const MERCARI_HASH_KEY = "listing-assist";
const MERCARI_ANONYMOUS_SHIPPING_METHODS = [
  "ネコポス",
  "宅急便コンパクト",
  "宅急便",
  "ゆうパケット",
  "ゆうパケットポスト",
  "ゆうパケットプラス",
  "ゆうパック",
];
const MERCARI_TAKKYUBIN_SIZES = ["60", "80", "100", "120", "140", "160", "180", "200"];
const YAHOO_AUCTION_PAYLOAD_PREFIX = "LISTING_ASSIST_YAHOO_AUCTION::";
const YAHOO_AUCTION_SELL_URL = "https://auctions.yahoo.co.jp/jp/show/submit?category=0";
const YAHOO_AUCTION_HASH_KEY = "listing-assist-yahoo";
const DETAIL_FETCH_HASH_KEY = "listing-assist-fetch";
const SYNC_SETTINGS_STORAGE_KEY = "listing-assist-sync-settings";
const SYNC_HISTORY_STORAGE_KEY = "listing-assist-sync-history";
const VIEW_MODE_STORAGE_KEY = "listing-assist-view-mode";
const DRIVE_API_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_DISCOVERY_SOURCE_LABEL = "Google Drive";
const BACKUP_FORMAT = "listing-assist-backup";
const BACKUP_SCHEMA_VERSION = 2;
const SHELF_QR_PREFIX = "listing-assist:shelf:v1:";
const DRIVE_CONFIG_QR_PREFIX = "listing-assist:drive-config:v1:";
const MAX_SHELF_CODE_LENGTH = 48;
const MAX_SHELF_QR_BATCH_SIZE = 500;
const SHELF_QR_LAYOUTS = {
  large: { perPage: 18 },
  standard: { perPage: 21 },
  compact: { perPage: 24 },
};
const BACKUP_STORE_NAMES = [
  "products",
  "listings",
  "inventories",
  "rawImports",
  "listingSummaries",
  "platformListingLinks",
];
const {
  ListingAssistDatabase,
  ProductRepository,
  ImportRepository,
  ListingRepository,
  InventoryRepository,
  ListingImportService,
} = globalThis;

const state = {
  products: [],
  listings: [],
  inventories: [],
  selectedId: null,
  checkedIds: new Set(),
  checkedLooseInventoryIds: new Set(),
  modalImages: [],
  productFetchedDetail: null,
  listingDetailFetchedDetail: null,
  looseInventoryFetchedDetail: null,
  inventoryInputDevice: "pc",
  shelfQrCodes: [],
  qrScannerTarget: null,
  qrScannerSource: "",
  qrScannerStream: null,
  qrScannerFrameRequest: 0,
  qrScannerActive: false,
  qrBarcodeDetector: null,
  desktopStatusTimer: 0,
  mobileStatusTimer: 0,
  detailFetchBatch: null,
  viewMode: "desktop",
  mobileTab: "search",
  importInProgress: false,
  reviewFilter: "all",
  syncSettings: {
    driveClientId: "",
    driveFileId: "",
    driveFolderId: "",
    deviceName: "",
    note: "",
  },
  syncHistory: {
    lastExportAt: "",
    lastExportFileName: "",
    lastExportMode: "",
    lastKnownDriveFileId: "",
    lastKnownDriveModifiedAt: "",
    lastImportAt: "",
    lastImportedDeviceName: "",
    lastImportedExportedAt: "",
    lastImportedFileName: "",
    lastImportedCounts: null,
  },
  driveAuth: {
    tokenClient: null,
    accessToken: "",
    expiresAt: 0,
    clientId: "",
  },
  backupImportConfirmResolver: null,
};

const elements = {
  mobileApp: document.getElementById("mobileApp"),
  desktopApp: document.getElementById("desktopApp"),
  switchToMobileButton: document.getElementById("switchToMobileButton"),
  switchToDesktopButton: document.getElementById("switchToDesktopButton"),
  mobileSearchInput: document.getElementById("mobileSearchInput"),
  mobileShelfMissingFilter: document.getElementById("mobileShelfMissingFilter"),
  mobileProductList: document.getElementById("mobileProductList"),
  mobileProductCount: document.getElementById("mobileProductCount"),
  mobileOpenQuickInventoryButton: document.getElementById("mobileOpenQuickInventoryButton"),
  mobileLooseInventorySummary: document.getElementById("mobileLooseInventorySummary"),
  mobileImportDriveButton: document.getElementById("mobileImportDriveButton"),
  mobileExportDriveButton: document.getElementById("mobileExportDriveButton"),
  mobileDriveSyncInfo: document.getElementById("mobileDriveSyncInfo"),
  mobileScanDriveConfigButton: document.getElementById("mobileScanDriveConfigButton"),
  mobileShowDriveConfigQrButton: document.getElementById("mobileShowDriveConfigQrButton"),
  mobileSeedButton: document.getElementById("mobileSeedButton"),
  mobileStatusMessage: document.getElementById("mobileStatusMessage"),
  mobilePanels: Array.from(document.querySelectorAll("[data-mobile-panel]")),
  mobileNavButtons: Array.from(document.querySelectorAll("[data-mobile-tab]")),
  productForm: document.getElementById("productForm"),
  productModal: document.getElementById("productModal"),
  inventoryForm: document.getElementById("inventoryForm"),
  inventoryModal: document.getElementById("inventoryModal"),
  inventoryModalTitle: document.getElementById("inventoryModalTitle"),
  closeInventoryModalButton: document.getElementById("closeInventoryModalButton"),
  looseInventoryForm: document.getElementById("looseInventoryForm"),
  looseInventoryModal: document.getElementById("looseInventoryModal"),
  closeLooseInventoryModalButton: document.getElementById("closeLooseInventoryModalButton"),
  resetLooseInventoryButton: document.getElementById("resetLooseInventoryButton"),
  openQuickInventoryButton: document.getElementById("openQuickInventoryButton"),
  openShelfQrButton: document.getElementById("openShelfQrButton"),
  looseInventoryId: document.getElementById("looseInventoryId"),
  looseInventoryTitle: document.getElementById("looseInventoryTitle"),
  looseInventoryPlatformUrl: document.getElementById("looseInventoryPlatformUrl"),
  looseInventoryShelfCode: document.getElementById("looseInventoryShelfCode"),
  looseInventoryStock: document.getElementById("looseInventoryStock"),
  looseInventoryInputDevice: document.getElementById("looseInventoryInputDevice"),
  looseInventoryLinkMemo: document.getElementById("looseInventoryLinkMemo"),
  looseInventorySummary: document.getElementById("looseInventorySummary"),
  looseInventoryList: document.getElementById("looseInventoryList"),
  listingDetailForm: document.getElementById("listingDetailForm"),
  listingDetailModal: document.getElementById("listingDetailModal"),
  listingDetailModalTitle: document.getElementById("listingDetailModalTitle"),
  closeListingDetailModalButton: document.getElementById("closeListingDetailModalButton"),
  saveListingDetailButton: document.getElementById("saveListingDetailButton"),
  listingDetailStatusBadge: document.getElementById("listingDetailStatusBadge"),
  listingDetailStatusText: document.getElementById("listingDetailStatusText"),
  listingDetailProductId: document.getElementById("listingDetailProductId"),
  listingDetailListingId: document.getElementById("listingDetailListingId"),
  listingDetailLinkMode: document.getElementById("listingDetailLinkMode"),
  listingDetailProductName: document.getElementById("listingDetailProductName"),
  listingDetailPlatform: document.getElementById("listingDetailPlatform"),
  listingDetailPlatformItemId: document.getElementById("listingDetailPlatformItemId"),
  listingDetailPlatformUrl: document.getElementById("listingDetailPlatformUrl"),
  fetchListingDetailUrlDetailButton: document.getElementById("fetchListingDetailUrlDetailButton"),
  listingDetailCondition: document.getElementById("listingDetailCondition"),
  listingDetailPrice: document.getElementById("listingDetailPrice"),
  listingDetailDescription: document.getElementById("listingDetailDescription"),
  listingDetailLinkButton: document.getElementById("listingDetailLinkButton"),
  inventoryProductId: document.getElementById("inventoryProductId"),
  inventoryProductName: document.getElementById("inventoryProductName"),
  inventoryShelfCode: document.getElementById("inventoryShelfCode"),
  inventoryStock: document.getElementById("inventoryStock"),
  inventoryLinkMemo: document.getElementById("inventoryLinkMemo"),
  scanInventoryShelfButton: document.getElementById("scanInventoryShelfButton"),
  scanLooseInventoryShelfButton: document.getElementById("scanLooseInventoryShelfButton"),
  shelfQrModal: document.getElementById("shelfQrModal"),
  closeShelfQrModalButton: document.getElementById("closeShelfQrModalButton"),
  shelfQrManualCodes: document.getElementById("shelfQrManualCodes"),
  addManualShelfCodesButton: document.getElementById("addManualShelfCodesButton"),
  shelfQrPrefix: document.getElementById("shelfQrPrefix"),
  shelfQrStart: document.getElementById("shelfQrStart"),
  shelfQrEnd: document.getElementById("shelfQrEnd"),
  shelfQrDigits: document.getElementById("shelfQrDigits"),
  addShelfRangeButton: document.getElementById("addShelfRangeButton"),
  existingShelfCodes: document.getElementById("existingShelfCodes"),
  addExistingShelfCodesButton: document.getElementById("addExistingShelfCodesButton"),
  shelfQrLayout: document.getElementById("shelfQrLayout"),
  shelfQrCount: document.getElementById("shelfQrCount"),
  shelfQrValidationMessage: document.getElementById("shelfQrValidationMessage"),
  clearShelfQrCodesButton: document.getElementById("clearShelfQrCodesButton"),
  printShelfQrButton: document.getElementById("printShelfQrButton"),
  shelfQrPreview: document.getElementById("shelfQrPreview"),
  shelfQrPrintArea: document.getElementById("shelfQrPrintArea"),
  qrScannerModal: document.getElementById("qrScannerModal"),
  closeQrScannerButton: document.getElementById("closeQrScannerButton"),
  cancelQrScannerButton: document.getElementById("cancelQrScannerButton"),
  retryQrScannerButton: document.getElementById("retryQrScannerButton"),
  qrScannerProductName: document.getElementById("qrScannerProductName"),
  qrScannerVideo: document.getElementById("qrScannerVideo"),
  qrScannerCanvas: document.getElementById("qrScannerCanvas"),
  qrScannerStatus: document.getElementById("qrScannerStatus"),
  modalTitle: document.getElementById("modalTitle"),
  closeModalButton: document.getElementById("closeModalButton"),
  openCreateModalButton: document.getElementById("openCreateModalButton"),
  imagePreviewModal: document.getElementById("imagePreviewModal"),
  imagePreviewLarge: document.getElementById("imagePreviewLarge"),
  imagePreviewTitle: document.getElementById("imagePreviewTitle"),
  imagePreviewMeta: document.getElementById("imagePreviewMeta"),
  imagePreviewProductName: document.getElementById("imagePreviewProductName"),
  imagePreviewListingShipping: document.getElementById("imagePreviewListingShipping"),
  imagePreviewStorage: document.getElementById("imagePreviewStorage"),
  closeImagePreviewButton: document.getElementById("closeImagePreviewButton"),
  csvImportModal: document.getElementById("csvImportModal"),
  csvImportEyebrow: document.getElementById("csvImportEyebrow"),
  csvImportTitle: document.getElementById("csvImportTitle"),
  csvImportBody: document.getElementById("csvImportBody"),
  csvImportMeta: document.getElementById("csvImportMeta"),
  cancelDetailFetchBatchButton: document.getElementById("cancelDetailFetchBatchButton"),
  closeCsvImportModalButton: document.getElementById("closeCsvImportModalButton"),
  backupImportConfirmModal: document.getElementById("backupImportConfirmModal"),
  backupImportConfirmTitle: document.getElementById("backupImportConfirmTitle"),
  backupImportConfirmBody: document.getElementById("backupImportConfirmBody"),
  backupImportConfirmMeta: document.getElementById("backupImportConfirmMeta"),
  closeBackupImportConfirmButton: document.getElementById("closeBackupImportConfirmButton"),
  cancelBackupImportConfirmButton: document.getElementById("cancelBackupImportConfirmButton"),
  acceptBackupImportConfirmButton: document.getElementById("acceptBackupImportConfirmButton"),
  modalPhotoPreview: document.getElementById("modalPhotoPreview"),
  productId: document.getElementById("productId"),
  sku: document.getElementById("sku"),
  title: document.getElementById("title"),
  brand: document.getElementById("brand"),
  category: document.getElementById("category"),
  condition: document.getElementById("condition"),
  storage: document.getElementById("storage"),
  price: document.getElementById("price"),
  platform: document.getElementById("platform"),
  itemUrl: document.getElementById("itemUrl"),
  fetchProductUrlDetailButton: document.getElementById("fetchProductUrlDetailButton"),
  platformItemId: document.getElementById("platformItemId"),
  stock: document.getElementById("stock"),
  shipping: document.getElementById("shipping"),
  shippingSize: document.getElementById("shippingSize"),
  shippingSizeGroup: document.getElementById("shippingSizeGroup"),
  tags: document.getElementById("tags"),
  description: document.getElementById("description"),
  memo: document.getElementById("memo"),
  photos: document.getElementById("photos"),
  searchInput: document.getElementById("searchInput"),
  productList: document.getElementById("productList"),
  statusMessage: document.getElementById("statusMessage"),
  resetFormButton: document.getElementById("resetFormButton"),
  duplicateButton: document.getElementById("duplicateButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  exportDriveJsonButton: document.getElementById("exportDriveJsonButton"),
  importDriveJsonButton: document.getElementById("importDriveJsonButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  selectImportCsvButton: document.getElementById("selectImportCsvButton"),
  selectImportJsonButton: document.getElementById("selectImportJsonButton"),
  selectedCsvFileName: document.getElementById("selectedCsvFileName"),
  reviewSummary: document.getElementById("reviewSummary"),
  looseInventoryNotice: document.getElementById("looseInventoryNotice"),
  importCsvInput: document.getElementById("importCsvInput"),
  csvPlatformHint: document.getElementById("csvPlatformHint"),
  importJsonInput: document.getElementById("importJsonInput"),
  driveClientId: document.getElementById("driveClientId"),
  driveFileId: document.getElementById("driveFileId"),
  driveFolderId: document.getElementById("driveFolderId"),
  syncDeviceName: document.getElementById("syncDeviceName"),
  syncNote: document.getElementById("syncNote"),
  showDriveSyncGuideButton: document.getElementById("showDriveSyncGuideButton"),
  showDriveConfigQrButton: document.getElementById("showDriveConfigQrButton"),
  driveSyncInfo: document.getElementById("driveSyncInfo"),
  driveConfigQrModal: document.getElementById("driveConfigQrModal"),
  closeDriveConfigQrButton: document.getElementById("closeDriveConfigQrButton"),
  driveConfigQrPreview: document.getElementById("driveConfigQrPreview"),
  driveConfigQrSummary: document.getElementById("driveConfigQrSummary"),
  seedButton: document.getElementById("seedButton"),
  productCount: document.getElementById("productCount"),
  stockCount: document.getElementById("stockCount"),
  locationCount: document.getElementById("locationCount"),
  productCardTemplate: document.getElementById("productCardTemplate"),
  bulkFetchDetailsButton: document.getElementById("bulkFetchDetailsButton"),
  bulkDeleteButton: document.getElementById("bulkDeleteButton"),
  selectAllCheckbox: document.getElementById("selectAllCheckbox"),
};

const database = new ListingAssistDatabase();
const productRepository = new ProductRepository(database);
const importRepository = new ImportRepository(database);
const listingRepository = new ListingRepository(database);
const inventoryRepository = new InventoryRepository(database);
const listingImportService = new ListingImportService({
  database,
  productRepository,
  importRepository,
  listingRepository,
});

let initialized = false;
let pendingUrlDetailFetch = null;

async function initializeApp() {
  if (initialized) return;
  initialized = true;
  bindEvents();
  loadSyncPreferences();
  initializeViewMode();
  configureEnvironmentFeatures();
  syncShippingSizeField(elements.shipping.value);
  updateImportCsvControlState();
  renderDriveSyncInfo();
  await database.open();
  await loadProducts();
  await backfillDerivedStoresFromProducts();
  await loadProducts();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeApp().catch((error) => {
      console.error("[Listing Assist] App initialization failed", error);
      setStatus(`初期化に失敗しました: ${error.message}`, true);
    });
  });
} else {
  initializeApp().catch((error) => {
    console.error("[Listing Assist] App initialization failed", error);
    setStatus(`初期化に失敗しました: ${error.message}`, true);
  });
}

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "unknown error"));
  if (shouldIgnoreGlobalError(reason)) return;
  console.error("[Listing Assist] Unhandled promise rejection", reason);
  setStatus(`処理に失敗しました: ${reason.message}`, true);
});

window.addEventListener("error", (event) => {
  const error = event.error instanceof Error ? event.error : new Error(String(event.message || "unknown error"));
  if (shouldIgnoreGlobalError(error, event.message)) return;
  console.error("[Listing Assist] Unhandled error", error);
  setStatus(`処理に失敗しました: ${error.message}`, true);
});

window.addEventListener("message", (event) => {
  handleIncomingDetailFetchMessage(event);
});

function bindEvents() {
  elements.switchToMobileButton?.addEventListener("click", () => setViewMode("mobile", true));
  elements.switchToDesktopButton?.addEventListener("click", () => setViewMode("desktop", true));
  elements.mobileNavButtons.forEach((button) => {
    button.addEventListener("click", () => setMobileTab(button.dataset.mobileTab));
  });
  elements.mobileSearchInput?.addEventListener("input", renderMobileProductLists);
  elements.mobileShelfMissingFilter?.addEventListener("change", renderMobileProductLists);
  elements.mobileOpenQuickInventoryButton?.addEventListener("click", () => openLooseInventoryModal("smartphone"));
  elements.mobileImportDriveButton?.addEventListener("click", wrapDriveAsyncEvent(importJsonFromDrive, "load"));
  elements.mobileExportDriveButton?.addEventListener("click", wrapDriveAsyncEvent(uploadJsonToDrive, "save"));
  elements.mobileScanDriveConfigButton?.addEventListener("click", wrapAsyncEvent(() => openQrScanner({
    source: "drive-config",
    productName: "Drive同期設定",
  })));
  elements.mobileShowDriveConfigQrButton?.addEventListener("click", showDriveConfigQr);
  elements.mobileSeedButton?.addEventListener("click", wrapAsyncEvent(seedSampleData));
  elements.productForm.addEventListener("submit", wrapAsyncEvent(handleSubmit));
  elements.inventoryForm?.addEventListener("submit", wrapAsyncEvent(handleInventorySubmit));
  elements.looseInventoryForm?.addEventListener("submit", wrapAsyncEvent(handleLooseInventorySubmit));
  elements.listingDetailForm?.addEventListener("submit", wrapAsyncEvent(handleListingDetailSubmit));
  elements.searchInput.addEventListener("input", renderProducts);
  elements.shipping.addEventListener("change", handleShippingChange);
  elements.itemUrl?.addEventListener("change", handleProductUrlChange);
  elements.fetchProductUrlDetailButton?.addEventListener("click", () => {
    beginUrlDetailFetch({
      context: "product-form",
      url: elements.itemUrl?.value.trim() || "",
    });
  });
  elements.resetFormButton.addEventListener("click", resetForm);
  elements.duplicateButton.addEventListener("click", wrapAsyncEvent(handleDuplicate));
  elements.openCreateModalButton.addEventListener("click", openModalForCreate);
  elements.openQuickInventoryButton?.addEventListener("click", () => openLooseInventoryModal("smartphone"));
  elements.openShelfQrButton?.addEventListener("click", openShelfQrModal);
  elements.scanInventoryShelfButton?.addEventListener("click", wrapAsyncEvent(() => openQrScanner({
    target: elements.inventoryShelfCode,
    source: "inventory",
    productName: elements.inventoryProductName?.value || "選択中の商品",
  })));
  elements.scanLooseInventoryShelfButton?.addEventListener("click", wrapAsyncEvent(() => openQrScanner({
    target: elements.looseInventoryShelfCode,
    source: "loose-inventory",
    productName: elements.looseInventoryTitle?.value || elements.looseInventoryPlatformUrl?.value || "新しい商品",
  })));
  elements.closeModalButton.addEventListener("click", () => elements.productModal.close());
  elements.closeInventoryModalButton?.addEventListener("click", () => elements.inventoryModal.close());
  elements.closeLooseInventoryModalButton?.addEventListener("click", () => elements.looseInventoryModal.close());
  elements.resetLooseInventoryButton?.addEventListener("click", () => populateLooseInventoryForm());
  elements.closeListingDetailModalButton?.addEventListener("click", () => elements.listingDetailModal.close());
  elements.listingDetailPlatformUrl?.addEventListener("change", handleListingDetailUrlChange);
  elements.fetchListingDetailUrlDetailButton?.addEventListener("click", () => {
    beginUrlDetailFetch({
      context: "listing-detail",
      url: elements.listingDetailPlatformUrl?.value.trim() || "",
    });
  });
  elements.photos.addEventListener("change", wrapAsyncEvent(handlePhotoInputChange));
  elements.exportJsonButton.addEventListener("click", wrapAsyncEvent(exportJson));
  elements.exportDriveJsonButton?.addEventListener("click", wrapDriveAsyncEvent(uploadJsonToDrive, "save"));
  elements.importDriveJsonButton?.addEventListener("click", wrapDriveAsyncEvent(importJsonFromDrive, "load"));
  elements.exportCsvButton.addEventListener("click", wrapAsyncEvent(exportCsv));
  elements.selectImportCsvButton?.addEventListener("click", () => {
    if (state.importInProgress) return;
    elements.importCsvInput.value = "";
    updateImportCsvControlState();
    elements.importCsvInput.click();
  });
  elements.importCsvInput.addEventListener("change", wrapAsyncEvent(handleImportCsvSelection));
  elements.selectImportJsonButton?.addEventListener("click", () => {
    elements.importJsonInput.value = "";
    elements.importJsonInput.click();
  });
  elements.importJsonInput.addEventListener("change", wrapAsyncEvent(importJson));
  elements.driveClientId?.addEventListener("input", handleSyncSettingsInput);
  elements.driveFileId?.addEventListener("input", handleSyncSettingsInput);
  elements.driveFolderId?.addEventListener("input", handleSyncSettingsInput);
  elements.syncDeviceName?.addEventListener("input", handleSyncSettingsInput);
  elements.syncNote?.addEventListener("input", handleSyncSettingsInput);
  elements.showDriveSyncGuideButton?.addEventListener("click", showDriveSyncGuide);
  elements.showDriveConfigQrButton?.addEventListener("click", showDriveConfigQr);
  elements.closeDriveConfigQrButton?.addEventListener("click", () => elements.driveConfigQrModal?.close());
  elements.driveConfigQrModal?.addEventListener("click", handleDriveConfigQrModalBackdropClick);
  elements.seedButton.addEventListener("click", wrapAsyncEvent(seedSampleData));
  elements.productModal.addEventListener("click", handleModalBackdropClick);
  elements.inventoryModal?.addEventListener("click", handleInventoryModalBackdropClick);
  elements.looseInventoryModal?.addEventListener("click", handleLooseInventoryModalBackdropClick);
  elements.listingDetailModal?.addEventListener("click", handleListingDetailModalBackdropClick);
  elements.closeImagePreviewButton.addEventListener("click", () => elements.imagePreviewModal.close());
  elements.imagePreviewModal.addEventListener("click", handleImageModalBackdropClick);
  elements.closeCsvImportModalButton?.addEventListener("click", () => {
    if (state.importInProgress) return;
    elements.csvImportModal.close();
  });
  elements.cancelDetailFetchBatchButton?.addEventListener("click", cancelDetailFetchBatch);
  elements.closeBackupImportConfirmButton?.addEventListener("click", () => resolveBackupImportConfirm(false));
  elements.cancelBackupImportConfirmButton?.addEventListener("click", () => resolveBackupImportConfirm(false));
  elements.acceptBackupImportConfirmButton?.addEventListener("click", () => resolveBackupImportConfirm(true));
  elements.csvImportModal?.addEventListener("click", handleCsvImportModalBackdropClick);
  elements.backupImportConfirmModal?.addEventListener("click", handleBackupImportConfirmModalBackdropClick);
  elements.backupImportConfirmModal?.addEventListener("close", handleBackupImportConfirmModalClose);
  elements.bulkDeleteButton?.addEventListener("click", wrapAsyncEvent(handleBulkDelete));
  elements.bulkFetchDetailsButton?.addEventListener("click", wrapAsyncEvent(handleBulkFetchSelectedDetails));
  elements.selectAllCheckbox?.addEventListener("change", handleSelectAllChange);
  elements.closeShelfQrModalButton?.addEventListener("click", () => elements.shelfQrModal.close());
  elements.addManualShelfCodesButton?.addEventListener("click", addManualShelfQrCodes);
  elements.addShelfRangeButton?.addEventListener("click", addShelfQrRange);
  elements.addExistingShelfCodesButton?.addEventListener("click", addSelectedExistingShelfCodes);
  elements.clearShelfQrCodesButton?.addEventListener("click", clearShelfQrCodes);
  elements.shelfQrLayout?.addEventListener("change", renderShelfQrPreview);
  elements.printShelfQrButton?.addEventListener("click", printShelfQrLabels);
  elements.shelfQrModal?.addEventListener("click", handleShelfQrModalBackdropClick);
  elements.closeQrScannerButton?.addEventListener("click", closeQrScanner);
  elements.cancelQrScannerButton?.addEventListener("click", closeQrScanner);
  elements.retryQrScannerButton?.addEventListener("click", wrapAsyncEvent(startQrCamera));
  elements.qrScannerModal?.addEventListener("click", handleQrScannerModalBackdropClick);
  elements.qrScannerModal?.addEventListener("close", stopQrCamera);
  window.addEventListener("afterprint", finishShelfQrPrint);
}

function initializeViewMode() {
  const requestedMode = new URLSearchParams(location.search).get("view");
  const savedMode = readViewModePreference();
  const automaticMode = isMobileViewport() ? "mobile" : "desktop";
  const initialMode = ["mobile", "desktop"].includes(requestedMode)
    ? requestedMode
    : savedMode || automaticMode;
  setViewMode(initialMode, false);
}

function readViewModePreference() {
  try {
    const value = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return ["mobile", "desktop"].includes(value) ? value : "";
  } catch {
    return "";
  }
}

function isMobileViewport() {
  const userAgent = String(globalThis.navigator?.userAgent || "").toLowerCase();
  return globalThis.matchMedia?.("(max-width: 760px)")?.matches || /iphone|android|mobile/.test(userAgent);
}

function setViewMode(mode, persist = false) {
  const normalizedMode = mode === "mobile" ? "mobile" : "desktop";
  state.viewMode = normalizedMode;
  document.body.dataset.viewMode = normalizedMode;
  elements.mobileApp?.classList.toggle("is-hidden", normalizedMode !== "mobile");
  elements.desktopApp?.classList.toggle("is-hidden", normalizedMode !== "desktop");
  if (persist) {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, normalizedMode);
    } catch {
      // 表示モードの保存に失敗しても、現在の画面切替は継続する。
    }
  }
  if (normalizedMode === "mobile") {
    setMobileTab(state.mobileTab || "search");
    renderMobileViews();
  }
}

function setMobileTab(tabName) {
  const availableTabs = new Set(["search", "quick", "sync"]);
  const selectedTab = availableTabs.has(tabName) ? tabName : "search";
  state.mobileTab = selectedTab;
  elements.mobilePanels.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.mobilePanel !== selectedTab);
  });
  elements.mobileNavButtons.forEach((button) => {
    const isActive = button.dataset.mobileTab === selectedTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
  renderMobileViews();
}

function configureEnvironmentFeatures() {
  const environment = String(document.querySelector('meta[name="listing-assist-environment"]')?.content || "production").trim();
  document.body.dataset.environment = environment;
  elements.mobileSeedButton?.classList.toggle("is-hidden", environment !== "test");
}

function wrapAsyncEvent(handler) {
  return (event) => {
    Promise.resolve(handler(event)).catch((error) => {
      console.error("[Listing Assist] Event handler failed", error);
      setStatus(`処理に失敗しました: ${error.message}`, true);
    });
  };
}

function wrapDriveAsyncEvent(handler, operation) {
  return (event) => {
    Promise.resolve(handler(event)).catch((error) => {
      console.error("[Listing Assist] Drive operation failed", error);
      const actionLabel = operation === "save" ? "Driveへの保存" : "Driveからの読み込み";
      const message = `${actionLabel}に失敗しました: ${error.message}`;
      setStatus(message, true);
      showDriveOperationModal({
        title: `${actionLabel}に失敗しました`,
        body: error.message || "Google Driveとの通信中にエラーが発生しました。",
        meta: [
          `処理: ${actionLabel}`,
          `ファイルID: ${extractDriveFileId(state.syncSettings.driveFileId) || "未設定"}`,
          `エラー詳細: ${error.message || "不明なエラー"}`,
        ].join("\n"),
        tone: "error",
      });
    });
  };
}

function shouldIgnoreGlobalError(error, fallbackMessage = "") {
  const message = String(error?.message || fallbackMessage || "").toLowerCase();
  const stack = String(error?.stack || "").toLowerCase();
  const combined = `${message}\n${stack}`;

  const knownMetaMaskPatterns = [
    "failed to connect to metamask",
    "metamask",
    "ethereum provider",
  ];

  const isKnownMetaMaskError = knownMetaMaskPatterns.some((pattern) => combined.includes(pattern));
  if (isKnownMetaMaskError) {
    console.warn("[Listing Assist] Ignored external extension error", error);
    return true;
  }

  return false;
}

async function loadProducts() {
  try {
    let products = await productRepository.getAll();
    if (products.length === 0) {
      const restoredCount = await recoverProductsFromListingSummaries();
      if (restoredCount > 0) {
        products = await productRepository.getAll();
        setStatus(`出品一覧データから ${restoredCount} 件の一覧表示データを復旧しました`);
      }
    }

    const [listings, inventories] = await Promise.all([
      listingRepository.getAll(),
      inventoryRepository.getAll(),
    ]);
    state.listings = listings;
    state.inventories = inventories;
    state.products = products.map((product) => buildProductViewModel(product)).sort(sortByUpdatedAtDesc);
    state.checkedIds = new Set(
      state.products.filter((product) => state.checkedIds.has(product.id)).map((product) => product.id),
    );
    state.checkedLooseInventoryIds = new Set(
      state.inventories
        .filter((inventory) => !String(inventory?.pid || "").trim())
        .filter((inventory) => state.checkedLooseInventoryIds.has(inventory.iid))
        .map((inventory) => inventory.iid),
    );
    if (!state.selectedId && state.products[0]) {
      state.selectedId = state.products[0].id;
    }
    renderAll();

    if (state.products.length === 0) {
      await showEmptyStateHint();
    }
  } catch (error) {
    setStatus(`データの読み込みに失敗しました: ${error.message}`, true);
  }
}

async function recoverProductsFromListingSummaries() {
  const listingSummaries = await database.getAll("listingSummaries");
  if (!Array.isArray(listingSummaries) || listingSummaries.length === 0) {
    return 0;
  }

  const recoveredProducts = listingSummaries.map((summary) => buildRecoveredProductFromSummary(summary));
  await database.runTransaction(["products", "listings"], "readwrite", (stores) => {
    recoveredProducts.forEach((product) => {
      stores.products.put(buildProductMasterRecord(product));
      stores.listings.put(buildListingFromProduct(product));
    });
  });
  return recoveredProducts.length;
}

function buildRecoveredProductFromSummary(summary) {
  const now = new Date().toISOString();
  return {
    id: summary.summaryId || crypto.randomUUID(),
    sku: summary.inventoryManagementId || summary.platformItemId || "",
    title: summary.title || "",
    brand: "",
    category: "",
    condition: summary.condition || "目立った傷や汚れなし",
    storage: "",
    price: Number(summary.price || 0),
    platform: summary.platform || "",
    stock: 1,
    shipping: "",
    shippingSize: "",
    tags: [],
    description: "",
    memo: "",
    photos: summary.imageUrl ? [summary.imageUrl] : [],
    inventoryManagementId: summary.inventoryManagementId || "",
    platformItemId: summary.platformItemId || "",
    platformItemKey: buildPlatformItemKeyFromProduct(summary.platform, summary.platformItemId),
    itemUrl: summary.itemUrl || "",
    editUrl: summary.editUrl || "",
    listingStatus: summary.status || "",
    latestImportId: summary.importId || "",
    latestImportAt: summary.importedAt || "",
    externalData: {
      [summary.platform || "unknown"]: {
        summaryId: summary.summaryId || "",
        platformItemId: summary.platformItemId || "",
        itemUrl: summary.itemUrl || "",
        editUrl: summary.editUrl || "",
        imageUrl: summary.imageUrl || "",
        status: summary.status || "",
        platformSpecific: summary.platformSpecific || {},
      },
    },
    createdAt: summary.importedAt || now,
    updatedAt: summary.importedAt || now,
  };
}

async function showEmptyStateHint() {
  try {
    const [rawImports, listingSummaries] = await Promise.all([
      database.getAll("rawImports"),
      database.getAll("listingSummaries"),
    ]);

    if (rawImports.length > 0 || listingSummaries.length > 0) {
      setStatus(
        `商品マスターは0件です。読み込み履歴 ${rawImports.length} 件 / 出品一覧データ ${listingSummaries.length} 件が残っています。`,
        true,
      );
      return;
    }

    setStatus("商品マスターはまだ登録されていません");
  } catch (error) {
    setStatus(`商品データは0件です。補助データ確認にも失敗しました: ${error.message}`, true);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const formData = new FormData(elements.productForm);
  const id = elements.productId.value || crypto.randomUUID();
  const rawItemUrl = String(formData.get("itemUrl") || "").trim();
  const manualPlatform = normalizePlatform(formData.get("platform"));
  const detectedPlatform = detectPlatformFromListingUrl(rawItemUrl);
  const resolvedPlatform = manualPlatform || detectedPlatform;
  const detectedPlatformItemId = extractPlatformItemIdFromListingUrl(resolvedPlatform, rawItemUrl);
  const manualPlatformItemId = String(formData.get("platformItemId") || "").trim();
  const resolvedPlatformItemId = manualPlatformItemId || detectedPlatformItemId;
  const existingProduct = getSelectedProduct();

  const product = {
    ...(existingProduct || {}),
    id,
    sku: formData.get("sku")?.toString().trim() || "",
    title: formData.get("title")?.toString().trim() || "",
    brand: formData.get("brand")?.toString().trim() || "",
    category: formData.get("category")?.toString().trim() || "",
    condition: formData.get("condition")?.toString().trim() || "",
    storage: formData.get("storage")?.toString().trim() || "",
    price: Number(formData.get("price") || 0),
    platform: resolvedPlatform,
    stock: Number(formData.get("stock") || 0),
    shipping: normalizeShippingMethod(formData.get("shipping")),
    shippingSize: normalizeShippingSize(formData.get("shipping"), formData.get("shippingSize")),
    tags: splitTags(formData.get("tags")),
    description: formData.get("description")?.toString().trim() || "",
    memo: formData.get("memo")?.toString().trim() || "",
    photos: [...state.modalImages],
    platformItemId: resolvedPlatformItemId,
    platformItemKey: buildPlatformItemKeyFromProduct(resolvedPlatform, resolvedPlatformItemId),
    itemUrl: rawItemUrl,
    externalData: mergeFetchedDetailIntoExternalData(existingProduct?.externalData || {}, state.productFetchedDetail),
    createdAt: existingProduct?.createdAt || now,
    updatedAt: now,
  };

  await upsertProduct(product);
  state.selectedId = product.id;
  elements.photos.value = "";
  state.modalImages = [];
  state.productFetchedDetail = null;
  elements.productModal.close();
  setStatus("商品を保存しました");
}

async function upsertProduct(product) {
  const productRecord = buildProductMasterRecord(product);
  const listing = buildListingFromProduct(product);
  const inventory = buildInventoryFromProduct(product);
  await database.runTransaction(["products", "listings", "inventories"], "readwrite", (stores) => {
    stores.products.put(productRecord);
    stores.listings.put(listing);
    stores.inventories.put(inventory);
  });
  await loadProducts();
}

function renderAll() {
  renderProducts();
  renderStats();
  renderReviewSummary();
  renderLooseInventoryNotice();
  renderLooseInventoryModalState();
  renderMobileViews();
}

function renderMobileViews() {
  if (!elements.mobileApp) return;
  renderMobileProductLists();
  renderMobileQuickSummary();
  renderMobileDriveSyncInfo();
}

function renderMobileProductLists() {
  const searchKeyword = String(elements.mobileSearchInput?.value || "").trim().toLowerCase();
  const showMissingShelfOnly = Boolean(elements.mobileShelfMissingFilter?.checked);
  const searchProducts = state.products.filter((product) => {
    if (!matchesKeyword(product, searchKeyword)) return false;
    return !showMissingShelfOnly || !getMobileProductShelfCode(product);
  });
  if (elements.mobileProductCount) elements.mobileProductCount.textContent = `${searchProducts.length}件`;
  renderMobileProductCards(elements.mobileProductList, searchProducts);
}

function getMobileProductShelfCode(product) {
  return String(getPrimaryInventory(product.id)?.shelfCode || product.storage || "").trim();
}

function getProductPlatforms(product) {
  const platforms = new Set();
  const addPlatform = (value) => {
    const platform = normalizePlatform(value);
    if (platform === "メルカリ" || platform === "ヤフオク") platforms.add(platform);
  };

  addPlatform(product.platform);
  state.listings.forEach((listing) => {
    if (listing?.pid === product.id) addPlatform(listing.platform);
  });
  addPlatform(getImportedListingForProduct(product)?.platform);

  return ["メルカリ", "ヤフオク"].filter((platform) => platforms.has(platform));
}

function renderMobileProductCards(container, products) {
  if (!container) return;
  container.innerHTML = "";
  if (products.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mobile-empty-state";
    empty.textContent = state.products.length === 0 ? "商品はまだ登録されていません。" : "条件に一致する商品がありません。";
    container.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => {
    const shelfCode = getMobileProductShelfCode(product);
    const card = document.createElement("article");
    card.className = "mobile-product-card";

    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "mobile-product-image-button";
    imageButton.setAttribute("aria-label", `${product.title || "商品"}の画像を表示`);
    const image = document.createElement("img");
    image.src = getPreviewImage(product);
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    imageButton.append(image);
    imageButton.addEventListener("click", () => openImagePreview(product));

    const content = document.createElement("div");
    content.className = "mobile-product-content";
    const sku = document.createElement("span");
    sku.className = "mobile-product-sku";
    sku.textContent = product.sku || "SKU未設定";
    const title = document.createElement("strong");
    title.className = "mobile-product-title";
    title.textContent = product.title || "商品タイトル未設定";
    content.append(sku, title);

    const platforms = getProductPlatforms(product);
    const platformList = document.createElement("div");
    platformList.className = "mobile-platform-list";
    const displayedPlatforms = platforms.length > 0 ? platforms : ["出品先未設定"];
    displayedPlatforms.forEach((platform) => {
      const badge = document.createElement("span");
      const platformClass = platform === "メルカリ" ? "mercari" : platform === "ヤフオク" ? "yahoo" : "unset";
      badge.className = `mobile-platform-badge is-${platformClass}`;
      badge.textContent = platform;
      platformList.append(badge);
    });
    content.append(platformList);
    if (shelfCode) {
      const shelf = document.createElement("span");
      shelf.className = "mobile-shelf-badge";
      shelf.textContent = shelfCode;
      content.append(shelf);
    }

    card.append(imageButton, content);
    if (!shelfCode) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "mobile-card-action";
      action.textContent = "棚登録";
      action.setAttribute("aria-label", `${product.title || product.sku || "商品"}の棚を登録`);
      action.addEventListener("click", wrapAsyncAction(async () => {
        await openMobileShelfRegistration(product.id);
      }));
      card.append(action);
    }
    fragment.append(card);
  });
  container.append(fragment);
}

function renderMobileQuickSummary() {
  if (!elements.mobileLooseInventorySummary) return;
  const looseCount = getLooseInventories().length;
  elements.mobileLooseInventorySummary.textContent = looseCount > 0
    ? `自動登録できず確認待ちの在庫が ${looseCount} 件あります。PC版から内容を修正できます。`
    : "未処理の仮登録データはありません。";
}

function renderMobileDriveSyncInfo() {
  if (!elements.mobileDriveSyncInfo) return;
  const settingsReady = Boolean(state.syncSettings.driveClientId && extractDriveFileId(state.syncSettings.driveFileId));
  const importLabel = state.syncHistory.lastImportAt ? formatDateTime(state.syncHistory.lastImportAt) : "未実行";
  const exportLabel = state.syncHistory.lastExportAt ? formatDateTime(state.syncHistory.lastExportAt) : "未実行";
  elements.mobileDriveSyncInfo.textContent = [
    `同期設定: ${settingsReady ? "設定済み" : "未設定"}`,
    `最終読み込み: ${importLabel}`,
    `最終保存: ${exportLabel}`,
    `端末名: ${state.syncSettings.deviceName || getDefaultDeviceName()}`,
  ].join("\n");
}

async function openMobileShelfRegistration(productId) {
  openInventoryModal(productId);
  state.inventoryInputDevice = "smartphone";
  const product = state.products.find((item) => item.id === productId) || null;
  await openQrScanner({
    target: elements.inventoryShelfCode,
    source: "inventory",
    productName: product?.title || product?.sku || "選択中の商品",
  });
}

function renderProducts() {
  if (state.reviewFilter === "product_missing") {
    renderLooseInventoryRows();
    return;
  }

  const products = getFilteredProducts();
  elements.productList.innerHTML = "";

  if (products.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 9;
    emptyCell.className = "empty-state";
    emptyCell.textContent = getReviewEmptyMessage();
    emptyRow.append(emptyCell);
    elements.productList.append(emptyRow);
    updateBulkSelectionControls(products);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const product of products) {
    const node = elements.productCardTemplate.content.firstElementChild.cloneNode(true);
    const inventory = getPrimaryInventory(product.id);
    const linkStatus = getProductLinkStatus(product);
    const reviewFlags = getProductReviewFlags(product, linkStatus, inventory);
    const rowCheckbox = node.querySelector(".row-select-checkbox");
    rowCheckbox.checked = state.checkedIds.has(product.id);
    rowCheckbox.setAttribute("aria-label", `${product.title || "商品"} を選択`);
    rowCheckbox.addEventListener("click", (event) => event.stopPropagation());
    rowCheckbox.addEventListener("change", () => {
      toggleCheckedProduct(product.id, rowCheckbox.checked);
    });

    const thumbButton = node.querySelector(".thumb-button");
    const thumbImage = node.querySelector(".thumb-image");
    const imageSrc = getPreviewImage(product);
    thumbImage.referrerPolicy = "no-referrer";
    thumbImage.loading = "lazy";
    thumbImage.src = imageSrc;
    thumbImage.alt = `${product.title || "商品"} の画像`;
    node.querySelector(".cell-sku").textContent = product.sku || "-";
    node.querySelector(".cell-title").textContent = product.title || "-";
    node.querySelector(".cell-storage").textContent = inventory?.shelfCode || product.storage || "未設定";
    node.querySelector(".cell-stock").textContent = String(inventory?.stock ?? product.stock ?? 0);
    renderPlatformCell(node.querySelector(".cell-platform"), product, linkStatus, reviewFlags);
    node.querySelector(".cell-updated").textContent = formatDate(product.updatedAt);

    if (product.id === state.selectedId) {
      node.classList.add("is-selected");
    }
    if (state.checkedIds.has(product.id)) {
      node.classList.add("is-checked");
    }

    node.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.selectedId = product.id;
      renderAll();
    });

    thumbButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openImagePreview(product);
    });

    const confirmLinkButton = node.querySelector(".action-confirm-link");
    if (linkStatus.mode === "linked") {
      confirmLinkButton.hidden = true;
    } else {
      confirmLinkButton.hidden = false;
      confirmLinkButton.addEventListener("click", () => {
        openListingDetailModal(product.id);
      });
    }

    node.querySelector(".action-edit").addEventListener("click", () => {
      openModalForEdit(product.id);
    });

    node.querySelector(".action-mercari").addEventListener("click", async () => {
      await handleMercariAssist(product);
    });

    node.querySelector(".action-yahoo").addEventListener("click", async () => {
      await handleYahooAuctionAssist(product);
    });

    node.querySelector(".action-inventory").addEventListener("click", () => {
      openInventoryModal(product.id);
    });

    node.querySelector(".action-delete").addEventListener("click", async () => {
      const ok = window.confirm(`${product.title}を削除しますか？`);
      if (!ok) return;
      await deleteProduct(product.id);
      setStatus("商品を削除しました");
    });

    fragment.append(node);
  }

  elements.productList.append(fragment);
  updateBulkSelectionControls(products);
}

function renderLooseInventoryRows() {
  elements.productList.innerHTML = "";
  const looseInventories = getFilteredLooseInventories();

  if (looseInventories.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 9;
    emptyCell.className = "empty-state";
    emptyCell.textContent = getReviewEmptyMessage();
    emptyRow.append(emptyCell);
    elements.productList.append(emptyRow);
    updateBulkSelectionControls([]);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const inventory of looseInventories) {
    const row = document.createElement("tr");
    row.className = "inventory-row inventory-row-loose";

    row.innerHTML = `
      <td class="cell-check"><input class="row-select-checkbox" type="checkbox"></td>
      <td class="cell-photo">-</td>
      <td class="cell-sku">-</td>
      <td class="cell-title"></td>
      <td class="cell-storage"></td>
      <td class="cell-stock"></td>
      <td class="cell-platform"></td>
      <td class="cell-updated"></td>
      <td class="cell-actions"></td>
    `;

    const rowCheckbox = row.querySelector(".row-select-checkbox");
    rowCheckbox.checked = state.checkedLooseInventoryIds.has(inventory.iid);
    rowCheckbox.setAttribute("aria-label", `${inventory.title || inventory.shelfCode || "商品情報未入力"} を選択`);
    rowCheckbox.addEventListener("click", (event) => event.stopPropagation());
    rowCheckbox.addEventListener("change", () => {
      toggleCheckedLooseInventory(inventory.iid, rowCheckbox.checked);
      row.classList.toggle("is-checked", rowCheckbox.checked);
    });
    row.classList.toggle("is-checked", state.checkedLooseInventoryIds.has(inventory.iid));

    row.querySelector(".cell-title").textContent = inventory.title || "商品情報未入力";
    row.querySelector(".cell-storage").textContent = inventory.shelfCode || "未設定";
    row.querySelector(".cell-stock").textContent = String(Number(inventory.stock || 0));
    row.querySelector(".cell-updated").textContent = formatDate(inventory.updatedAt);

    const platformCell = row.querySelector(".cell-platform");
    const platformName = document.createElement("div");
    platformName.className = "platform-name";
    platformName.textContent = inventory.platform || "未判定";
    const meta = document.createElement("div");
    meta.className = "shipping-note";
    meta.textContent = formatInputDeviceLabel(inventory.inputDevice);
    platformCell.append(platformName, meta);

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "secondary-button";
    retryButton.textContent = "再試行";
    retryButton.addEventListener("click", wrapAsyncAction(async () => {
      await promoteLooseInventoryToProduct(inventory.iid);
    }));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost-button";
    editButton.textContent = "在庫入力";
    editButton.addEventListener("click", () => {
      openLooseInventoryModal("smartphone");
      populateLooseInventoryForm(inventory, inventory.inputDevice || "smartphone");
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ghost-button danger-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", wrapAsyncAction(async () => {
      await deleteLooseInventory(inventory.iid);
    }));

    actions.append(retryButton, editButton, deleteButton);
    row.querySelector(".cell-actions").append(actions);
    fragment.append(row);
  }

  elements.productList.append(fragment);
  updateBulkSelectionControls(looseInventories);
}

function renderStats() {
  const totalProducts = state.products.length;
  const stockCount = state.products.reduce((sum, product) => {
    const inventory = getPrimaryInventory(product.id);
    return sum + Number(inventory?.stock ?? product.stock ?? 0);
  }, 0);
  const locationCount = new Set(
    state.products.map((product) => getPrimaryInventory(product.id)?.shelfCode || product.storage).filter(Boolean),
  ).size;

  elements.productCount.textContent = String(totalProducts);
  elements.stockCount.textContent = String(stockCount);
  elements.locationCount.textContent = String(locationCount);
  document.body.classList.toggle("has-products", totalProducts > 0);
}

function renderReviewSummary() {
  if (!elements.reviewSummary) return;

  const counts = {
    review: 0,
    platform_mercari: 0,
    platform_yahoo: 0,
    detail_missing: 0,
    needs_link: 0,
    image_missing: 0,
    storage_missing: 0,
    product_missing: getLooseInventories().length,
  };

  state.products.forEach((product) => {
    const platforms = getProductPlatforms(product);
    if (platforms.includes("メルカリ")) counts.platform_mercari += 1;
    if (platforms.includes("ヤフオク")) counts.platform_yahoo += 1;
    const flags = getProductReviewFlags(product);
    if (flags.some((flag) => flag.key !== "storage_missing")) counts.review += 1;
    flags.forEach((flag) => {
      if (counts[flag.key] !== undefined) counts[flag.key] += 1;
    });
  });

  elements.reviewSummary.innerHTML = "";

  const fragment = document.createDocumentFragment();
  const label = document.createElement("span");
  label.className = "review-summary-label";
  label.textContent = "絞り込み";
  fragment.append(label);
  [
    { key: "platform_mercari", label: "メルカリ", tone: "mercari" },
    { key: "platform_yahoo", label: "ヤフオク", tone: "yahoo" },
    { key: "review", label: "要確認（まとめ）", tone: "danger" },
    { key: "detail_missing", label: "商品詳細なし", tone: "muted" },
    { key: "needs_link", label: "出品情報を確認", tone: "warning" },
    { key: "image_missing", label: "画像未取得", tone: "warning" },
    { key: "storage_missing", label: "棚未設定", tone: "muted" },
    { key: "product_missing", label: "商品情報未入力", tone: "warning" },
  ].forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `review-chip is-${item.tone}`;
    button.dataset.filter = item.key;
    const isActive = state.reviewFilter === item.key;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-empty", counts[item.key] === 0);
    button.disabled = counts[item.key] === 0 && !isActive;
    button.textContent = `${item.label} ${counts[item.key] || 0}`;
    button.addEventListener("click", () => {
      setReviewFilter(item.key);
    });
    fragment.append(button);
  });

  if (state.reviewFilter !== "all") {
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "review-filter-clear";
    clearButton.textContent = "絞り込み解除";
    clearButton.addEventListener("click", () => setReviewFilter("all"));
    fragment.append(clearButton);
  }

  const visibleUnresolvedCount = getFilteredProducts().filter((product) => getProductLinkStatus(product).mode === "unlinked").length;
  if (visibleUnresolvedCount > 0) {
    const bulkConfirmButton = document.createElement("button");
    bulkConfirmButton.type = "button";
    bulkConfirmButton.className = "review-bulk-confirm";
    bulkConfirmButton.textContent = `表示中の出品情報を一括確定 (${visibleUnresolvedCount})`;
    bulkConfirmButton.addEventListener("click", wrapAsyncAction(handleConfirmVisibleLinks));
    fragment.append(bulkConfirmButton);
  }

  elements.reviewSummary.append(fragment);

}

function renderLooseInventoryNotice() {
  if (!elements.looseInventoryNotice) return;

  const looseInventories = getLooseInventories();
  if (looseInventories.length === 0) {
    elements.looseInventoryNotice.innerHTML = "";
    elements.looseInventoryNotice.classList.add("is-hidden");
    return;
  }

  elements.looseInventoryNotice.classList.remove("is-hidden");
  elements.looseInventoryNotice.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "loose-inventory-notice-heading";

  const title = document.createElement("strong");
  title.textContent = `自動商品登録に失敗した在庫が ${looseInventories.length} 件あります`;

  const action = document.createElement("button");
  action.type = "button";
  action.className = "ghost-button";
  action.textContent = "スマホ在庫入力を開く";
  action.addEventListener("click", () => openLooseInventoryModal("smartphone"));

  heading.append(title, action);

  const description = document.createElement("p");
  description.className = "loose-inventory-notice-copy";
  description.textContent =
    "通常は保存時に自動で商品登録されます。失敗したデータだけここに残るので、編集して再試行してください。";

  const preview = document.createElement("div");
  preview.className = "loose-inventory-notice-preview";
  looseInventories.slice(0, 3).forEach((inventory) => {
    const chip = document.createElement("span");
    chip.className = "review-flag is-muted";
    const parts = [
      inventory.title || "入力不足",
      inventory.shelfCode || "棚未設定",
      formatInputDeviceLabel(inventory.inputDevice),
    ].filter(Boolean);
    chip.textContent = parts.join(" / ");
    preview.append(chip);
  });

  if (looseInventories.length > 3) {
    const more = document.createElement("span");
    more.className = "review-flag is-warning";
    more.textContent = `ほか ${looseInventories.length - 3} 件`;
    preview.append(more);
  }

  elements.looseInventoryNotice.append(heading, description, preview);
}

function populateForm(product) {
  if (!product) {
    elements.productForm.reset();
    elements.productId.value = "";
    if (elements.itemUrl) elements.itemUrl.value = "";
    if (elements.platformItemId) elements.platformItemId.value = "";
    elements.stock.value = "1";
    elements.shippingSize.value = "";
    elements.photos.value = "";
    elements.modalTitle.textContent = "新規登録";
    elements.duplicateButton.classList.add("is-hidden");
    elements.resetFormButton.classList.add("is-hidden");
    state.modalImages = [];
    state.productFetchedDetail = null;
    syncShippingSizeField("");
    renderModalPhotoPreview([]);
    return;
  }

  elements.modalTitle.textContent = "商品を編集";
  elements.duplicateButton.classList.remove("is-hidden");
  elements.resetFormButton.classList.remove("is-hidden");
  elements.productId.value = product.id;
  elements.sku.value = product.sku;
  elements.title.value = product.title;
  elements.brand.value = product.brand;
  elements.category.value = product.category;
  elements.condition.value = product.condition;
  elements.storage.value = getPrimaryInventory(product.id)?.shelfCode || product.storage;
  elements.price.value = product.price || "";
  elements.platform.value = product.platform || "";
  if (elements.itemUrl) elements.itemUrl.value = product.itemUrl || "";
  if (elements.platformItemId) elements.platformItemId.value = product.platformItemId || "";
  elements.stock.value = getPrimaryInventory(product.id)?.stock ?? product.stock;
  elements.shipping.value = normalizeShippingMethod(product.shipping);
  elements.shippingSize.value = normalizeShippingSize(product.shipping, product.shippingSize);
  elements.tags.value = product.tags.join(", ");
  elements.description.value = product.description;
  elements.memo.value = getPrimaryInventory(product.id)?.linkMemo || product.memo;
  elements.photos.value = "";
  state.productFetchedDetail = null;
  syncShippingSizeField(elements.shipping.value);
  state.modalImages = Array.isArray(product.photos) ? [...product.photos] : [];
  renderModalPhotoPreview(state.modalImages, product.title || "商品");
}

function openModalForCreate() {
  state.selectedId = null;
  populateForm(null);
  elements.productModal.showModal();
  elements.sku.focus();
}

function openModalForEdit(productId) {
  state.selectedId = productId;
  populateForm(getSelectedProduct());
  elements.productModal.showModal();
  elements.title.focus();
}

function handleProductUrlChange() {
  const url = elements.itemUrl?.value.trim() || "";
  if (!url) return;

  const detectedPlatform = detectPlatformFromListingUrl(url);
  const detectedPlatformItemId = extractPlatformItemIdFromListingUrl(detectedPlatform, url);

  if (detectedPlatform && elements.platform && !elements.platform.value.trim()) {
    elements.platform.value = detectedPlatform;
  }

  if (detectedPlatformItemId && elements.platformItemId && !elements.platformItemId.value.trim()) {
    elements.platformItemId.value = detectedPlatformItemId;
  }
}

function beginUrlDetailFetch({ context, url }) {
  if (state.detailFetchBatch?.active) {
    setStatus("一括取得が完了してから個別取得を実行してください", true);
    return;
  }
  if (pendingUrlDetailFetch) {
    setStatus("別の商品詳細を取得中です", true);
    return;
  }
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    setStatus("先に販売ページURLを入力してください", true);
    return;
  }

  const platform = detectPlatformFromListingUrl(normalizedUrl);
  if (!platform) {
    setStatus("URLの出品先を判定できませんでした", true);
    return;
  }

  const requestId = crypto.randomUUID();
  pendingUrlDetailFetch = {
    requestId,
    context,
    mode: "single",
    startedAt: Date.now(),
  };

  const request = {
    type: "listing-assist-fetch-detail",
    requestId,
    returnOrigin: location.origin,
    context,
  };

  const fetchUrl = new URL(normalizedUrl);
  fetchUrl.hash = `${DETAIL_FETCH_HASH_KEY}=${encodeURIComponent(encodePayload(request))}`;
  const detailWindow = window.open(fetchUrl.toString(), "_blank");
  if (!detailWindow) {
    pendingUrlDetailFetch = null;
    setStatus("ポップアップがブロックされたため詳細取得を開始できませんでした", true);
    return;
  }

  setStatus("販売ページを開いて詳細取得を待っています...");
}

function handleIncomingDetailFetchMessage(event) {
  if (!isAllowedDetailFetchOrigin(event.origin)) return;
  const payload = event.data;
  if (!payload || payload.type !== "listing-assist-detail-result") return;
  if (!pendingUrlDetailFetch || pendingUrlDetailFetch.requestId !== payload.requestId) return;

  const pendingRequest = pendingUrlDetailFetch;
  pendingUrlDetailFetch = null;
  if (pendingRequest.timeoutId) window.clearTimeout(pendingRequest.timeoutId);

  if (pendingRequest.mode === "batch") {
    pendingRequest.resolve(payload);
    return;
  }

  if (!payload.ok) {
    setStatus(`URLからの詳細取得に失敗しました: ${payload.error || "unknown error"}`, true);
    return;
  }

  applyFetchedDetailToContext(payload.context, payload.detail || {});
  setStatus("URLから商品詳細を取得しました");
}

async function handleBulkFetchSelectedDetails() {
  if (state.detailFetchBatch?.active) {
    setStatus("商品詳細の一括取得はすでに実行中です", true);
    return;
  }
  if (pendingUrlDetailFetch) {
    setStatus("個別の商品詳細取得が完了してから実行してください", true);
    return;
  }
  if (state.reviewFilter === "product_missing") {
    setStatus("商品情報未入力データは一括取得の対象外です", true);
    return;
  }

  const selectedProducts = state.products.filter((product) => state.checkedIds.has(product.id));
  if (selectedProducts.length === 0) {
    setStatus("詳細を取得する商品を選択してください", true);
    return;
  }

  const targets = selectedProducts.map((product) => ({
    product,
    target: getBatchDetailFetchTarget(product),
  }));
  const runnableTargets = targets.filter((item) => item.target);
  const missingUrlTargets = targets.filter((item) => !item.target);
  if (runnableTargets.length === 0) {
    showOperationStatusModal({
      eyebrow: "商品詳細の一括取得",
      title: "取得できる商品URLがありません",
      body: "選択した商品にメルカリまたはヤフオクの商品URLを登録してください。",
      meta: missingUrlTargets.map((item) => `対象外: ${item.product.sku || item.product.title || item.product.id}`).join("\n"),
      tone: "error",
    });
    return;
  }

  const confirmationLines = [
    `選択した ${selectedProducts.length} 件のうち、URLがある ${runnableTargets.length} 件から商品詳細を取得します。`,
    "販売ページを1件ずつ開くため、処理中は専用タブを閉じないでください。",
    "既存の入力値は残し、空欄の項目と写真を補完します。",
  ];
  if (missingUrlTargets.length > 0) {
    confirmationLines.push(`URLがない ${missingUrlTargets.length} 件は処理せず、結果に表示します。`);
  }
  if (!window.confirm(confirmationLines.join("\n"))) return;

  const workerWindow = window.open("about:blank", "listing-assist-detail-worker");
  if (!workerWindow) {
    setStatus("ポップアップがブロックされたため一括取得を開始できませんでした", true);
    return;
  }

  const batch = {
    active: true,
    cancelRequested: false,
    total: selectedProducts.length,
    runnable: runnableTargets.length,
    completed: 0,
    successes: [],
    failures: missingUrlTargets.map((item) => ({
      product: item.product,
      reason: "商品URLがありません",
    })),
    workerWindow,
  };
  state.detailFetchBatch = batch;
  if (elements.cancelDetailFetchBatchButton) {
    elements.cancelDetailFetchBatchButton.classList.remove("is-hidden");
    elements.cancelDetailFetchBatchButton.disabled = false;
    elements.cancelDetailFetchBatchButton.textContent = "処理を中止";
  }
  updateBulkSelectionControls(getFilteredProducts());

  try {
    for (let index = 0; index < runnableTargets.length; index += 1) {
      const item = runnableTargets[index];
      const label = item.product.sku || item.product.title || item.product.id;
      if (batch.cancelRequested) {
        runnableTargets.slice(index).forEach((remaining) => {
          batch.failures.push({ product: remaining.product, reason: "ユーザーが処理を中止しました" });
        });
        break;
      }
      if (workerWindow.closed) {
        runnableTargets.slice(index).forEach((remaining) => {
          batch.failures.push({ product: remaining.product, reason: "取得用タブが閉じられました" });
        });
        break;
      }

      showOperationStatusModal({
        eyebrow: "商品詳細の一括取得",
        title: `${index + 1} / ${runnableTargets.length} 件目を取得中`,
        body: `${label} の販売ページから写真と商品情報を取得しています。`,
        meta: [
          `成功: ${batch.successes.length} 件`,
          `失敗・対象外: ${batch.failures.length} 件`,
          `出品先: ${item.target.platform}`,
        ].join("\n"),
        tone: "progress",
      });

      try {
        const payload = await requestBatchDetailFetch(item, workerWindow);
        if (!payload.ok) throw new Error(payload.error || "販売ページから詳細を取得できませんでした");
        if (!hasUsableFetchedDetail(payload.detail)) throw new Error("取得結果に保存できる商品情報がありません");
        await saveBatchFetchedDetail(item, payload.detail);
        batch.successes.push(item.product);
        state.checkedIds.delete(item.product.id);
      } catch (error) {
        batch.failures.push({ product: item.product, reason: error.message || "詳細取得に失敗しました" });
      }
      batch.completed += 1;

      if (batch.cancelRequested) {
        runnableTargets.slice(index + 1).forEach((remaining) => {
          batch.failures.push({ product: remaining.product, reason: "ユーザーが処理を中止しました" });
        });
        break;
      }

      if (index < runnableTargets.length - 1 && !workerWindow.closed) {
        await delayBatchDetailFetch(1500);
      }
    }
  } finally {
    if (pendingUrlDetailFetch?.mode === "batch") {
      if (pendingUrlDetailFetch.timeoutId) window.clearTimeout(pendingUrlDetailFetch.timeoutId);
      pendingUrlDetailFetch = null;
    }
    try {
      if (!workerWindow.closed) workerWindow.close();
    } catch (_error) {
      // The browser may already have closed the cross-origin worker tab.
    }
    batch.active = false;
    state.detailFetchBatch = null;
    if (elements.cancelDetailFetchBatchButton) {
      elements.cancelDetailFetchBatchButton.classList.add("is-hidden");
      elements.cancelDetailFetchBatchButton.disabled = false;
      elements.cancelDetailFetchBatchButton.textContent = "処理を中止";
    }
    await loadProducts();

    const failureLines = batch.failures.map(({ product, reason }) => (
      `${product.sku || product.title || product.id}: ${reason}`
    ));
    showOperationStatusModal({
      eyebrow: "商品詳細の一括取得",
      title: batch.cancelRequested
        ? "一括取得を中止しました"
        : batch.failures.length > 0 ? "一括取得が完了しました（一部未処理）" : "一括取得が完了しました",
      body: `成功 ${batch.successes.length} 件 / 未処理 ${batch.failures.length} 件`,
      meta: failureLines.length > 0
        ? ["未処理の商品", ...failureLines].join("\n")
        : "選択した商品の写真と不足していた詳細情報を保存しました。",
      tone: batch.successes.length > 0 ? "success" : "error",
    });
    setStatus(
      batch.cancelRequested
        ? `商品詳細の一括取得を中止しました: 成功 ${batch.successes.length} 件 / 未処理 ${batch.failures.length} 件`
        : `商品詳細を一括取得しました: 成功 ${batch.successes.length} 件 / 未処理 ${batch.failures.length} 件`,
      !batch.cancelRequested && batch.successes.length === 0,
    );
  }
}

function cancelDetailFetchBatch() {
  const batch = state.detailFetchBatch;
  if (!batch?.active || batch.cancelRequested) return;

  batch.cancelRequested = true;
  if (elements.cancelDetailFetchBatchButton) {
    elements.cancelDetailFetchBatchButton.disabled = true;
    elements.cancelDetailFetchBatchButton.textContent = "停止中...";
  }
  showOperationStatusModal({
    eyebrow: "商品詳細の一括取得",
    title: "処理を停止しています",
    body: "現在の取得を中断し、未処理の商品を選択状態のまま残します。",
    meta: `成功済み: ${batch.successes.length} 件`,
    tone: "progress",
  });

  if (pendingUrlDetailFetch?.mode === "batch") {
    const pendingRequest = pendingUrlDetailFetch;
    pendingUrlDetailFetch = null;
    if (pendingRequest.timeoutId) window.clearTimeout(pendingRequest.timeoutId);
    pendingRequest.reject(new Error("ユーザーが処理を中止しました"));
  }
  try {
    if (batch.workerWindow && !batch.workerWindow.closed) batch.workerWindow.close();
  } catch (_error) {
    // Ignore close failures for a cross-origin worker tab.
  }
}

function getBatchDetailFetchTarget(product) {
  const canonicalListing = getCanonicalListingForProductId(product.id);
  const importedListing = getImportedListingForProduct(product);
  const externalEntries = Object.values(product.externalData || {});
  const candidates = [
    { url: canonicalListing?.platformUrl, listing: canonicalListing },
    { url: importedListing?.platformUrl, listing: importedListing },
    { url: product.itemUrl, listing: canonicalListing || importedListing || null },
    ...externalEntries.map((entry) => ({ url: entry?.itemUrl, listing: canonicalListing || importedListing || null })),
  ];

  for (const candidate of candidates) {
    const url = String(candidate.url || "").trim();
    const platform = detectPlatformFromListingUrl(url);
    if (url && platform) return { url, platform, listing: candidate.listing || null };
  }
  return null;
}

function requestBatchDetailFetch(item, workerWindow) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const request = {
      type: "listing-assist-fetch-detail",
      requestId,
      returnOrigin: location.origin,
      context: "batch-detail",
      keepOpen: true,
    };
    const fetchUrl = new URL(item.target.url);
    fetchUrl.hash = `${DETAIL_FETCH_HASH_KEY}=${encodeURIComponent(encodePayload(request))}`;

    const timeoutId = window.setTimeout(() => {
      if (pendingUrlDetailFetch?.requestId === requestId) pendingUrlDetailFetch = null;
      reject(new Error("販売ページから30秒以内に応答がありませんでした"));
    }, 30000);
    pendingUrlDetailFetch = {
      requestId,
      context: "batch-detail",
      mode: "batch",
      startedAt: Date.now(),
      timeoutId,
      resolve,
      reject,
    };

    try {
      workerWindow.location.href = fetchUrl.toString();
    } catch (error) {
      window.clearTimeout(timeoutId);
      pendingUrlDetailFetch = null;
      reject(error);
    }
  });
}

function hasUsableFetchedDetail(detail) {
  if (!detail) return false;
  return Boolean(
    String(detail.imageUrl || "").trim() ||
    (Array.isArray(detail.imageUrls) && detail.imageUrls.some(Boolean)) ||
    String(detail.title || "").trim() ||
    String(detail.description || "").trim() ||
    Number(detail.price || 0) > 0,
  );
}

async function saveBatchFetchedDetail(item, detail) {
  const product = item.product;
  const target = item.target;
  const now = new Date().toISOString();
  const fetchedImages = [
    ...(Array.isArray(detail.imageUrls) ? detail.imageUrls : []),
    detail.imageUrl,
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const photos = [...new Set([...(product.photos || []), ...fetchedImages])];
  const platform = normalizePlatform(target.platform || detail.platform);
  const updatedProduct = {
    ...product,
    title: String(product.title || detail.title || "").trim(),
    photos,
    externalData: mergeFetchedDetailIntoExternalData(product.externalData || {}, detail, {
      platform,
      platformItemId: detail.platformItemId || product.platformItemId || "",
      itemUrl: target.url,
    }),
    updatedAt: now,
  };

  const existingListing = target.listing || null;
  const listing = {
    ...(existingListing || {}),
    lid: existingListing?.lid || buildPrimaryListingId(product.id),
    pid: existingListing ? String(existingListing.pid || "") : product.id,
    platform: existingListing?.platform || platform,
    platformListingId: existingListing?.platformListingId || detail.platformItemId || product.platformItemId || "",
    platformUrl: existingListing?.platformUrl || detail.platformUrl || target.url,
    imageUrl: existingListing?.imageUrl || fetchedImages[0] || "",
    brand: existingListing?.brand || detail.brand || product.brand || "",
    category: existingListing?.category || detail.category || product.category || "",
    description: existingListing?.description || detail.description || product.description || "",
    condition: existingListing?.condition || normalizeInternalCondition(detail.condition) || product.condition || "",
    price: Number(existingListing?.price || detail.price || product.price || 0),
    importedAt: existingListing?.importedAt || now,
    importSource: existingListing?.importSource || "url-batch",
    linkState: existingListing?.linkState || "confirmed",
    listingStatus: existingListing?.listingStatus || product.listingStatus || "",
    shipping: existingListing?.shipping || detail.shipping || product.shipping || "",
    shippingSize: existingListing?.shippingSize || detail.shippingSize || product.shippingSize || "",
    tags: Array.isArray(existingListing?.tags) ? [...existingListing.tags] : [],
    updatedAt: now,
  };

  await database.runTransaction(["products", "listings"], "readwrite", (stores) => {
    stores.products.put(buildProductMasterRecord(updatedProduct));
    stores.listings.put(listing);
  });
}

function delayBatchDetailFetch(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isAllowedDetailFetchOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (origin === location.origin) return true;
    return isAllowedListingHost(url.hostname);
  } catch (_error) {
    return false;
  }
}

function applyFetchedDetailToContext(context, detail) {
  if (context === "product-form") {
    applyFetchedDetailToProductForm(detail);
    return;
  }
  if (context === "listing-detail") {
    applyFetchedDetailToListingDetailForm(detail);
    return;
  }
  if (context === "loose-inventory") {
    applyFetchedDetailToLooseInventoryForm(detail);
  }
}

function applyFetchedDetailToProductForm(detail) {
  const resolvedCondition = resolveFetchedCondition(detail);
  state.productFetchedDetail = detail;
  if (!elements.title.value.trim()) elements.title.value = detail.title || "";
  if (!elements.brand.value.trim()) elements.brand.value = detail.brand || "";
  if (!elements.category.value.trim()) elements.category.value = detail.category || "";
  if (resolvedCondition) elements.condition.value = resolvedCondition;
  if (!elements.price.value.trim() && Number(detail.price || 0) > 0) elements.price.value = String(Number(detail.price || 0));
  if (!elements.platform.value.trim()) elements.platform.value = detail.platform || "";
  if (!elements.itemUrl.value.trim()) elements.itemUrl.value = detail.platformUrl || "";
  if (!elements.platformItemId.value.trim()) elements.platformItemId.value = detail.platformItemId || "";
  if (!elements.description.value.trim()) elements.description.value = detail.description || "";
  if (!elements.shipping.value.trim()) elements.shipping.value = normalizeShippingMethod(detail.shipping);
  if (!elements.shippingSize.value.trim()) elements.shippingSize.value = normalizeShippingSize(detail.shipping, detail.shippingSize);

  const fetchedImages = Array.isArray(detail.imageUrls) && detail.imageUrls.length > 0
    ? detail.imageUrls
    : (detail.imageUrl ? [detail.imageUrl] : []);
  if (fetchedImages.length > 0) {
    state.modalImages = [...new Set([...fetchedImages, ...state.modalImages].filter(Boolean))];
    renderModalPhotoPreview(state.modalImages, elements.title.value.trim() || detail.title || "商品");
  }

  syncShippingSizeField(elements.shipping.value);
}

function applyFetchedDetailToListingDetailForm(detail) {
  const resolvedCondition = resolveFetchedCondition(detail);
  state.listingDetailFetchedDetail = detail;
  if (!elements.listingDetailPlatform.value.trim()) elements.listingDetailPlatform.value = detail.platform || "";
  if (!elements.listingDetailPlatformItemId.value.trim()) elements.listingDetailPlatformItemId.value = detail.platformItemId || "";
  if (!elements.listingDetailPlatformUrl.value.trim()) elements.listingDetailPlatformUrl.value = detail.platformUrl || "";
  if (!elements.listingDetailCondition.value.trim()) elements.listingDetailCondition.value = resolvedCondition || "";
  if (!elements.listingDetailPrice.value.trim() && Number(detail.price || 0) > 0) {
    elements.listingDetailPrice.value = String(Number(detail.price || 0));
  }
  if (!elements.listingDetailDescription.value.trim()) elements.listingDetailDescription.value = detail.description || "";
}

function applyFetchedDetailToLooseInventoryForm(detail) {
  if (!elements.looseInventoryTitle.value.trim()) elements.looseInventoryTitle.value = detail.title || "";
  if (!elements.looseInventoryPlatformUrl.value.trim()) elements.looseInventoryPlatformUrl.value = detail.platformUrl || "";
  state.looseInventoryFetchedDetail = detail;
}

function openInventoryModal(productId) {
  const product = state.products.find((item) => item.id === productId) || null;
  if (!product) {
    setStatus("在庫編集対象の商品が見つかりません", true);
    return;
  }

  const inventory = getPrimaryInventory(product.id);
  state.inventoryInputDevice = "pc";
  elements.inventoryModalTitle.textContent = "棚登録・在庫編集";
  elements.inventoryProductId.value = product.id;
  elements.inventoryProductName.value = product.title || product.sku || "商品";
  elements.inventoryShelfCode.value = inventory?.shelfCode || product.storage || "";
  elements.inventoryStock.value = String(inventory?.stock ?? product.stock ?? 0);
  elements.inventoryLinkMemo.value = inventory?.linkMemo || product.memo || "";
  elements.inventoryModal.showModal();
  elements.inventoryShelfCode.focus();
}

function openLooseInventoryModal(defaultDevice = "pc") {
  populateLooseInventoryForm(null, defaultDevice);
  elements.looseInventoryModal?.showModal();
  renderLooseInventoryModalState();
  elements.looseInventoryTitle?.focus();
}

function populateLooseInventoryForm(inventory = null, defaultDevice = "pc") {
  if (!elements.looseInventoryForm) return;
  state.looseInventoryFetchedDetail = inventory?.fetchedDetail || null;
  elements.looseInventoryId.value = inventory?.iid || "";
  elements.looseInventoryTitle.value = inventory?.title || "";
  elements.looseInventoryPlatformUrl.value = inventory?.platformUrl || "";
  elements.looseInventoryShelfCode.value = inventory?.shelfCode || "";
  elements.looseInventoryStock.value = String(inventory?.stock ?? 1);
  elements.looseInventoryInputDevice.value = inventory?.inputDevice || defaultDevice;
  elements.looseInventoryLinkMemo.value = inventory?.linkMemo || "";
  renderLooseInventorySummary();
}

function getLooseInventories() {
  return state.inventories
    .filter((inventory) => !String(inventory?.pid || "").trim())
    .sort(sortByUpdatedAtDesc);
}

function renderLooseInventoryModalState() {
  if (!elements.looseInventoryModal?.open) return;
  renderLooseInventorySummary();
  renderLooseInventoryList();
}

function renderLooseInventorySummary() {
  if (!elements.looseInventorySummary) return;
  const isEditing = Boolean(elements.looseInventoryId?.value);
  elements.looseInventorySummary.textContent = isEditing
    ? "確認待ちデータを修正しています。保存後に自動登録を再試行できます。"
    : "販売ページURLと商品タイトル、棚番号を入力して仮登録します。";
  elements.resetLooseInventoryButton?.classList.toggle("is-hidden", !isEditing);
}

function renderLooseInventoryList() {
  if (!elements.looseInventoryList) return;
  elements.looseInventoryList.innerHTML = "";

  const looseInventories = getLooseInventories();
  if (looseInventories.length === 0) {
    const empty = document.createElement("p");
    empty.className = "loose-inventory-empty";
    empty.textContent = "未紐付け在庫はまだありません。";
    elements.looseInventoryList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const inventory of looseInventories) {
    const card = document.createElement("article");
    card.className = "loose-inventory-card";

    const meta = document.createElement("div");
    meta.className = "loose-inventory-meta";

    const title = document.createElement("strong");
    title.textContent = inventory.title || inventory.shelfCode || "商品情報未入力";
    const stock = document.createElement("span");
    stock.textContent = `在庫 ${Number(inventory.stock || 0)}`;
    const shelf = document.createElement("span");
    shelf.textContent = inventory.shelfCode || "棚番号未設定";
    const device = document.createElement("span");
    device.textContent = formatInputDeviceLabel(inventory.inputDevice);
    const platform = document.createElement("span");
    platform.textContent = inventory.platform || "未判定";
    const updated = document.createElement("span");
    updated.textContent = formatDate(inventory.updatedAt);
    meta.append(title, shelf, stock, device, platform, updated);

    const memo = document.createElement("p");
    memo.className = "loose-inventory-memo";
    memo.textContent = inventory.linkMemo || "メモなし";

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "secondary-button";
    retryButton.textContent = "再試行";
    retryButton.addEventListener("click", wrapAsyncAction(async () => {
      await promoteLooseInventoryToProduct(inventory.iid);
    }));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost-button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => {
      populateLooseInventoryForm(inventory);
      renderLooseInventorySummary();
      elements.looseInventoryTitle?.focus();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ghost-button danger-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", wrapAsyncAction(async () => {
      await deleteLooseInventory(inventory.iid);
    }));

    actions.append(retryButton, editButton, deleteButton);
    card.append(meta, memo, actions);
    fragment.append(card);
  }

  elements.looseInventoryList.append(fragment);
}

function openListingDetailModal(productId) {
  const product = state.products.find((item) => item.id === productId) || null;
  if (!product) {
    setStatus("詳細確認対象の商品が見つかりません", true);
    return;
  }

  const linkStatus = getProductLinkStatus(product);
  const listing = linkStatus.listing;
  elements.listingDetailModalTitle.textContent = "商品詳細データ確認・編集";
  elements.listingDetailProductId.value = product.id;
  elements.listingDetailListingId.value = listing?.lid || "";
  elements.listingDetailLinkMode.value = linkStatus.mode;
  elements.listingDetailProductName.value = formatListingDetailProductName(product);
  elements.listingDetailPlatform.value = listing?.platform || product.platform || "";
  elements.listingDetailPlatformItemId.value = listing?.platformListingId || product.platformItemId || "";
  elements.listingDetailPlatformUrl.value = listing?.platformUrl || product.itemUrl || "";
  elements.listingDetailCondition.value = listing?.condition || product.condition || "";
  elements.listingDetailPrice.value = String(Number(listing?.price ?? product.price ?? 0) || "");
  elements.listingDetailDescription.value = listing?.description || product.description || "";
  syncListingDetailStatus(linkStatus, product.id);
  elements.listingDetailModal.showModal();
}

function handleModalBackdropClick(event) {
  const rect = elements.productModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    elements.productModal.close();
  }
}

function handleInventoryModalBackdropClick(event) {
  const rect = elements.inventoryModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    elements.inventoryModal.close();
  }
}

function handleLooseInventoryModalBackdropClick(event) {
  const rect = elements.looseInventoryModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    elements.looseInventoryModal.close();
  }
}

function handleListingDetailModalBackdropClick(event) {
  const rect = elements.listingDetailModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    elements.listingDetailModal.close();
  }
}

function openShelfQrModal() {
  refreshExistingShelfCodeOptions();
  renderShelfQrPreview();
  elements.shelfQrModal?.showModal();
}

function refreshExistingShelfCodeOptions() {
  if (!elements.existingShelfCodes) return;
  const shelfCodes = [...new Set(
    state.inventories
      .map((inventory) => String(inventory?.shelfCode || "").trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));

  elements.existingShelfCodes.innerHTML = "";
  if (shelfCodes.length === 0) {
    const empty = document.createElement("option");
    empty.disabled = true;
    empty.textContent = "使用中の棚番号はまだありません";
    elements.existingShelfCodes.append(empty);
    return;
  }

  shelfCodes.forEach((shelfCode) => {
    const option = document.createElement("option");
    option.value = shelfCode;
    option.textContent = shelfCode;
    elements.existingShelfCodes.append(option);
  });
}

function addManualShelfQrCodes() {
  const raw = String(elements.shelfQrManualCodes?.value || "");
  const codes = raw.split(/[\n,、]+/).map((value) => value.trim()).filter(Boolean);
  if (codes.length === 0) {
    setShelfQrValidationMessage("追加する棚番号を入力してください。", true);
    return;
  }
  if (addShelfQrCodes(codes)) {
    elements.shelfQrManualCodes.value = "";
  }
}

function addShelfQrRange() {
  const prefix = String(elements.shelfQrPrefix?.value || "").trim().toUpperCase();
  const start = Number(elements.shelfQrStart?.value);
  const end = Number(elements.shelfQrEnd?.value);
  const digits = Number(elements.shelfQrDigits?.value || 3);

  if (!prefix || /[\u0000-\u001f\u007f:]/.test(prefix)) {
    setShelfQrValidationMessage("英字欄には、棚番号の先頭に付ける文字を入力してください。", true);
    return;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    setShelfQrValidationMessage("開始・終了番号を正しく入力してください。", true);
    return;
  }
  if (![3, 4].includes(digits) || String(end).length > digits) {
    setShelfQrValidationMessage(`${digits}桁で表せる終了番号を指定してください。`, true);
    return;
  }

  const count = end - start + 1;
  if (count > MAX_SHELF_QR_BATCH_SIZE) {
    setShelfQrValidationMessage(`一度に追加できる連番は${MAX_SHELF_QR_BATCH_SIZE}件までです。範囲を分けてください。`, true);
    return;
  }

  const codes = Array.from({ length: count }, (_, index) => `${prefix}-${String(start + index).padStart(digits, "0")}`);
  addShelfQrCodes(codes);
}

function addSelectedExistingShelfCodes() {
  const codes = Array.from(elements.existingShelfCodes?.selectedOptions || []).map((option) => option.value);
  if (codes.length === 0) {
    setShelfQrValidationMessage("再発行する棚番号を選択してください。", true);
    return;
  }
  addShelfQrCodes(codes);
}

function addShelfQrCodes(rawCodes) {
  const normalized = [];
  try {
    rawCodes.forEach((code) => normalized.push(normalizeShelfCode(code)));
  } catch (error) {
    setShelfQrValidationMessage(error.message, true);
    return false;
  }

  const merged = [...new Set([...state.shelfQrCodes, ...normalized])];
  if (merged.length > MAX_SHELF_QR_BATCH_SIZE) {
    setShelfQrValidationMessage(`一度に発行できる棚QRは${MAX_SHELF_QR_BATCH_SIZE}件までです。`, true);
    return false;
  }

  const addedCount = merged.length - state.shelfQrCodes.length;
  state.shelfQrCodes = merged;
  renderShelfQrPreview();
  setShelfQrValidationMessage(
    addedCount > 0 ? `${addedCount}件を追加しました。` : "すべて発行対象へ追加済みです。",
    false,
  );
  return true;
}

function clearShelfQrCodes() {
  state.shelfQrCodes = [];
  renderShelfQrPreview();
  setShelfQrValidationMessage("発行対象をクリアしました。", false);
}

function normalizeShelfCode(value) {
  const shelfCode = String(value || "").trim();
  if (!shelfCode) {
    throw new Error("空の棚番号は発行できません。");
  }
  if (shelfCode.length > MAX_SHELF_CODE_LENGTH) {
    throw new Error(`棚番号は${MAX_SHELF_CODE_LENGTH}文字以内にしてください。`);
  }
  if (/[\u0000-\u001f\u007f]/.test(shelfCode)) {
    throw new Error("棚番号に改行や制御文字は使用できません。");
  }
  return shelfCode;
}

function buildShelfQrPayload(shelfCode) {
  return `${SHELF_QR_PREFIX}${normalizeShelfCode(shelfCode)}`;
}

function parseShelfQrPayload(payload) {
  const raw = String(payload || "").trim();
  if (!raw.startsWith(SHELF_QR_PREFIX)) {
    throw new Error("棚登録用のQRコードではありません。");
  }
  return normalizeShelfCode(raw.slice(SHELF_QR_PREFIX.length));
}

function buildDriveConfigQrPayload() {
  const clientId = String(state.syncSettings.driveClientId || "").trim();
  const driveFileId = extractDriveFileId(state.syncSettings.driveFileId);
  const driveFolderId = extractDriveFolderId(state.syncSettings.driveFolderId);
  if (!clientId || !clientId.endsWith(".apps.googleusercontent.com")) {
    throw new Error("有効なGoogle OAuthクライアントIDを設定してください。");
  }
  if (!isValidDriveResourceId(driveFileId)) {
    throw new Error("DriveファイルIDまたは共有URLを設定してください。");
  }
  if (driveFolderId && !isValidDriveResourceId(driveFolderId)) {
    throw new Error("保存先フォルダIDまたはURLを確認してください。");
  }
  return `${DRIVE_CONFIG_QR_PREFIX}${encodeURIComponent(JSON.stringify({
    type: "listing-assist-drive-config",
    version: 1,
    clientId,
    driveFileId,
    driveFolderId,
  }))}`;
}

function parseDriveConfigQrPayload(payload) {
  const raw = String(payload || "").trim();
  if (!raw.startsWith(DRIVE_CONFIG_QR_PREFIX)) {
    throw new Error("同期設定QRではありません。PC版で発行したスマホ連携QRを読み取ってください。");
  }
  let config;
  try {
    config = JSON.parse(decodeURIComponent(raw.slice(DRIVE_CONFIG_QR_PREFIX.length)));
  } catch {
    throw new Error("同期設定QRの内容を読み取れませんでした。");
  }
  const clientId = String(config?.clientId || "").trim();
  const driveFileId = extractDriveFileId(config?.driveFileId);
  const driveFolderId = extractDriveFolderId(config?.driveFolderId);
  if (config?.type !== "listing-assist-drive-config" || Number(config?.version) !== 1) {
    throw new Error("対応していない同期設定QRです。");
  }
  if (!clientId.endsWith(".apps.googleusercontent.com") || !isValidDriveResourceId(driveFileId)) {
    throw new Error("同期設定QRに必要な情報がありません。");
  }
  if (driveFolderId && !isValidDriveResourceId(driveFolderId)) {
    throw new Error("同期設定QRの保存先フォルダIDが不正です。");
  }
  return { clientId, driveFileId, driveFolderId };
}

function showDriveConfigQr() {
  handleSyncSettingsInput();
  if (typeof globalThis.qrcode !== "function") {
    setStatus("QR生成ライブラリを読み込めませんでした。通信状態を確認してください。", true);
    return;
  }
  try {
    const payload = buildDriveConfigQrPayload();
    const qr = globalThis.qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    elements.driveConfigQrPreview.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
    elements.driveConfigQrSummary.textContent = [
      "Google OAuthクライアントID: 設定済み",
      `DriveファイルID: ${extractDriveFileId(state.syncSettings.driveFileId)}`,
      `保存先フォルダID: ${extractDriveFolderId(state.syncSettings.driveFolderId) || "未設定"}`,
      "Googleへのログイン認証はスマホ側で別途必要です。",
    ].join("\n");
    elements.driveConfigQrModal?.showModal();
  } catch (error) {
    setStatus(error.message, true);
    window.alert(error.message);
  }
}

function handleDriveConfigQrModalBackdropClick(event) {
  const rect = elements.driveConfigQrModal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    elements.driveConfigQrModal.close();
  }
}

function setShelfQrValidationMessage(message, isError = false) {
  if (!elements.shelfQrValidationMessage) return;
  elements.shelfQrValidationMessage.textContent = message;
  elements.shelfQrValidationMessage.classList.toggle("is-error", Boolean(isError));
}

function getSelectedShelfQrLayout() {
  const value = String(elements.shelfQrLayout?.value || "standard");
  return SHELF_QR_LAYOUTS[value] ? value : "standard";
}

function renderShelfQrPreview() {
  if (!elements.shelfQrPreview) return;
  const count = state.shelfQrCodes.length;
  elements.shelfQrCount.textContent = `発行対象 ${count}件`;
  elements.printShelfQrButton.disabled = count === 0;
  renderShelfQrPages(elements.shelfQrPreview, state.shelfQrCodes, getSelectedShelfQrLayout(), true);
}

function renderShelfQrPages(container, shelfCodes, layout, showEmpty = false) {
  container.innerHTML = "";
  if (shelfCodes.length === 0) {
    if (showEmpty) {
      const empty = document.createElement("p");
      empty.className = "shelf-qr-empty";
      empty.textContent = "棚番号を追加すると、ここにA4印刷プレビューが表示されます。";
      container.append(empty);
    }
    return;
  }

  if (typeof globalThis.qrcode !== "function") {
    const error = document.createElement("p");
    error.className = "shelf-qr-empty";
    error.textContent = "QR生成ライブラリを読み込めませんでした。通信状態を確認して再読み込みしてください。";
    container.append(error);
    elements.printShelfQrButton.disabled = true;
    return;
  }

  if (globalThis.qrcode.stringToBytesFuncs?.["UTF-8"]) {
    globalThis.qrcode.stringToBytes = globalThis.qrcode.stringToBytesFuncs["UTF-8"];
  }

  const perPage = SHELF_QR_LAYOUTS[layout].perPage;
  for (let offset = 0; offset < shelfCodes.length; offset += perPage) {
    const page = document.createElement("section");
    page.className = "shelf-qr-page";
    page.dataset.layout = layout;
    page.setAttribute("aria-label", `棚QR ${Math.floor(offset / perPage) + 1}ページ目`);

    shelfCodes.slice(offset, offset + perPage).forEach((shelfCode) => {
      page.append(createShelfQrLabel(shelfCode));
    });
    container.append(page);
  }
}

function createShelfQrLabel(shelfCode) {
  const label = document.createElement("article");
  label.className = "shelf-qr-label";

  const qrContainer = document.createElement("div");
  qrContainer.className = "shelf-qr-image";
  const qr = globalThis.qrcode(0, "M");
  qr.addData(buildShelfQrPayload(shelfCode));
  qr.make();
  qrContainer.innerHTML = qr.createSvgTag({ scalable: true, margin: 4 });

  const code = document.createElement("strong");
  code.className = "shelf-qr-label-code";
  code.textContent = shelfCode;
  label.append(qrContainer, code);
  return label;
}

function printShelfQrLabels() {
  if (state.shelfQrCodes.length === 0 || !elements.shelfQrPrintArea) return;
  renderShelfQrPages(elements.shelfQrPrintArea, state.shelfQrCodes, getSelectedShelfQrLayout());
  elements.shelfQrPrintArea.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    window.print();
    window.setTimeout(finishShelfQrPrint, 1000);
  });
}

function finishShelfQrPrint() {
  elements.shelfQrPrintArea?.setAttribute("aria-hidden", "true");
}

function handleShelfQrModalBackdropClick(event) {
  const rect = elements.shelfQrModal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    elements.shelfQrModal.close();
  }
}

async function openQrScanner({ target = null, source, productName }) {
  if (!target && source !== "drive-config") return;
  state.qrScannerTarget = target;
  state.qrScannerSource = source;
  elements.qrScannerProductName.textContent = `登録対象: ${productName || "商品"}`;
  if (!elements.qrScannerModal.open) {
    elements.qrScannerModal.showModal();
  }
  await startQrCamera();
}

async function startQrCamera() {
  stopQrCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    elements.qrScannerStatus.textContent = state.qrScannerSource === "drive-config"
      ? "このブラウザーではカメラを利用できません。PC版で同期設定を手動入力してください。"
      : "このブラウザーではカメラを利用できません。棚番号を手動入力してください。";
    return;
  }

  elements.qrScannerStatus.textContent = "カメラを起動しています…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    state.qrScannerStream = stream;
    elements.qrScannerVideo.srcObject = stream;
    await elements.qrScannerVideo.play();
    state.qrScannerActive = true;
    state.qrBarcodeDetector = createQrBarcodeDetector();
    elements.qrScannerStatus.textContent = state.qrScannerSource === "drive-config"
      ? "PC版で表示したスマホ連携QRを枠内に映してください。"
      : "棚のQRコードを枠内に映してください。";
    scanQrVideoFrame();
  } catch (error) {
    console.warn("[Listing Assist] Camera start failed", error);
    elements.qrScannerStatus.textContent = "カメラを起動できませんでした。権限とHTTPS接続を確認するか、棚番号を手動入力してください。";
  }
}

function createQrBarcodeDetector() {
  if (typeof globalThis.BarcodeDetector !== "function") return null;
  try {
    return new globalThis.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function scanQrVideoFrame() {
  if (!state.qrScannerActive) return;
  const video = elements.qrScannerVideo;
  let rawValue = "";

  try {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (state.qrBarcodeDetector) {
        const codes = await state.qrBarcodeDetector.detect(video);
        rawValue = String(codes[0]?.rawValue || "");
      } else if (typeof globalThis.jsQR === "function") {
        rawValue = decodeQrFromVideoWithJsQr(video);
      } else {
        elements.qrScannerStatus.textContent = "QR読取ライブラリを読み込めませんでした。通信状態を確認してください。";
        stopQrCamera();
        return;
      }
    }
  } catch (error) {
    console.warn("[Listing Assist] QR frame decode failed", error);
  }

  if (rawValue && applyScannedQr(rawValue)) return;
  if (state.qrScannerActive) {
    state.qrScannerFrameRequest = requestAnimationFrame(scanQrVideoFrame);
  }
}

function decodeQrFromVideoWithJsQr(video) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return "";
  const scale = Math.min(1, 720 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = elements.qrScannerCanvas;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const result = globalThis.jsQR(imageData.data, width, height, { inversionAttempts: "dontInvert" });
  return String(result?.data || "");
}

function applyScannedQr(rawValue) {
  if (state.qrScannerSource === "drive-config") {
    return applyScannedDriveConfigQr(rawValue);
  }
  let shelfCode = "";
  try {
    shelfCode = parseShelfQrPayload(rawValue);
  } catch (error) {
    elements.qrScannerStatus.textContent = error.message;
    return false;
  }

  const target = state.qrScannerTarget;
  if (!target) return false;
  target.value = shelfCode;
  if (state.qrScannerSource === "inventory") {
    state.inventoryInputDevice = "qr";
  }
  if (state.qrScannerSource === "loose-inventory" && elements.looseInventoryInputDevice) {
    elements.looseInventoryInputDevice.value = "qr";
  }

  stopQrCamera();
  if (elements.qrScannerModal.open) elements.qrScannerModal.close();
  target.focus();
  setStatus(`棚番号 ${shelfCode} をQRから入力しました。内容を確認して保存してください。`);
  return true;
}

function applyScannedDriveConfigQr(rawValue) {
  let config;
  try {
    config = parseDriveConfigQrPayload(rawValue);
  } catch (error) {
    elements.qrScannerStatus.textContent = error.message;
    return false;
  }

  const replacingExisting = Boolean(
    state.syncSettings.driveClientId || state.syncSettings.driveFileId || state.syncSettings.driveFolderId,
  );
  const message = [
    replacingExisting ? "現在のDrive同期設定を上書きします。" : "このDrive同期設定を保存します。",
    `クライアントID: ${config.clientId}`,
    `DriveファイルID: ${config.driveFileId}`,
    `保存先フォルダID: ${config.driveFolderId || "未設定"}`,
    "読み取っただけではDriveの読み込み・保存は実行しません。",
  ].join("\n");
  if (!window.confirm(message)) {
    elements.qrScannerStatus.textContent = "同期設定の保存をキャンセルしました。別のQRを読み取れます。";
    return false;
  }

  state.syncSettings.driveClientId = config.clientId;
  state.syncSettings.driveFileId = config.driveFileId;
  state.syncSettings.driveFolderId = config.driveFolderId;
  if (elements.driveClientId) elements.driveClientId.value = config.clientId;
  if (elements.driveFileId) elements.driveFileId.value = config.driveFileId;
  if (elements.driveFolderId) elements.driveFolderId.value = config.driveFolderId;
  writeJsonStorage(SYNC_SETTINGS_STORAGE_KEY, state.syncSettings);
  renderDriveSyncInfo();
  renderMobileDriveSyncInfo();
  stopQrCamera();
  if (elements.qrScannerModal.open) elements.qrScannerModal.close();
  setStatus("同期設定QRを保存しました。「Driveから読み込む」を押すとGoogle認証が始まります。");
  return true;
}

function stopQrCamera() {
  state.qrScannerActive = false;
  if (state.qrScannerFrameRequest) {
    cancelAnimationFrame(state.qrScannerFrameRequest);
    state.qrScannerFrameRequest = 0;
  }
  state.qrScannerStream?.getTracks().forEach((track) => track.stop());
  state.qrScannerStream = null;
  state.qrBarcodeDetector = null;
  if (elements.qrScannerVideo) {
    elements.qrScannerVideo.pause();
    elements.qrScannerVideo.srcObject = null;
  }
}

function closeQrScanner() {
  const target = state.qrScannerTarget;
  stopQrCamera();
  if (elements.qrScannerModal?.open) elements.qrScannerModal.close();
  target?.focus();
}

function handleQrScannerModalBackdropClick(event) {
  const rect = elements.qrScannerModal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    closeQrScanner();
  }
}

function handleImageModalBackdropClick(event) {
  const rect = elements.imagePreviewModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    elements.imagePreviewModal.close();
  }
}

function handleCsvImportModalBackdropClick(event) {
  if (state.importInProgress) return;

  const rect = elements.csvImportModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    elements.csvImportModal.close();
  }
}

function handleBackupImportConfirmModalBackdropClick(event) {
  const rect = elements.backupImportConfirmModal.getBoundingClientRect();
  const isBackdropClick = (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );

  if (isBackdropClick) {
    resolveBackupImportConfirm(false);
  }
}

function handleBackupImportConfirmModalClose() {
  if (typeof state.backupImportConfirmResolver === "function") {
    const resolver = state.backupImportConfirmResolver;
    state.backupImportConfirmResolver = null;
    resolver(false);
  }
}

function openImagePreview(product) {
  openImagePreviewFromSource(getPreviewImage(product), product.title || "商品", {
    productName: sanitizeDisplayTitle(product.title) || "-",
    listingShipping: formatListingShippingSummary(product),
    storage: getPrimaryInventory(product.id)?.shelfCode || product.storage || "未設定",
  });
}

function openImagePreviewFromSource(src, title, details = null) {
  elements.imagePreviewLarge.referrerPolicy = "no-referrer";
  elements.imagePreviewLarge.src = src;
  elements.imagePreviewLarge.alt = `${title || "商品"} の拡大画像`;
  elements.imagePreviewTitle.textContent = "画像プレビュー";
  syncImagePreviewMeta(details);
  elements.imagePreviewModal.showModal();
}

function syncImagePreviewMeta(details) {
  const hasDetails = Boolean(details);
  elements.imagePreviewMeta.classList.toggle("is-hidden", !hasDetails);
  if (!hasDetails) return;
  elements.imagePreviewProductName.textContent = details.productName || "-";
  elements.imagePreviewListingShipping.textContent = details.listingShipping || "-";
  elements.imagePreviewStorage.textContent = details.storage || "未設定";
}

function getFilteredProducts() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  return state.products.filter((product) => {
    if (!matchesKeyword(product, keyword)) return false;
    if (state.reviewFilter === "all") return true;
    return matchesReviewFilter(product, state.reviewFilter);
  });
}

function getPrimaryInventory(productId) {
  const candidates = state.inventories.filter((inventory) => inventory.pid === productId);
  if (candidates.length === 0) return null;
  return (
    candidates.find((inventory) => inventory.iid === buildPrimaryInventoryId(productId)) ||
    [...candidates].sort((a, b) => (
      new Date(b.updatedAt || b.checkedAt || 0).getTime() - new Date(a.updatedAt || a.checkedAt || 0).getTime()
    ))[0]
  );
}

function getImportedListingForProduct(product) {
  const exact = state.listings.find((listing) => isImportedListing(listing) && listing.pid === product.id);
  if (exact) return exact;

  const platformItemKeys = getProductPlatformItemKeys(product);
  if (platformItemKeys.size === 0) return null;

  return (
    state.listings.find((listing) => {
      return (
        isImportedListing(listing) &&
        !listing.pid &&
        platformItemKeys.has(buildPlatformItemKeyFromProduct(listing.platform, listing.platformListingId))
      );
    }) || null
  );
}

function getProductPlatformItemKeys(product) {
  const keys = new Set();
  const legacyKey = String(product.platformItemId
    ? (product.platformItemKey || buildPlatformItemKeyFromProduct(product.platform, product.platformItemId))
    : "").trim();
  if (legacyKey) keys.add(legacyKey);

  Object.entries(product.externalData || {}).forEach(([platform, entry]) => {
    const platformItemId = String(entry?.platformItemId || "").trim();
    const key = platformItemId
      ? buildPlatformItemKeyFromProduct(entry?.platform || platform, platformItemId)
      : "";
    if (key) keys.add(key);
  });
  return keys;
}

function getProductLinkStatus(product) {
  const linkedListing = getLinkedListingForProduct(product);
  if (linkedListing) {
    return {
      mode: "linked",
      label: "出品情報あり",
      listing: linkedListing,
    };
  }

  const importedListing = getImportedListingForProduct(product);

  if (importedListing) {
    return {
      mode: "unlinked",
      label: "出品情報を確認",
      listing: importedListing,
    };
  }

  return {
    mode: "missing",
    label: "商品詳細なし",
    listing: null,
  };
}

function getProductReviewFlags(product, linkStatus = null, inventory = null) {
  const resolvedLinkStatus = linkStatus || getProductLinkStatus(product);
  const resolvedInventory = inventory || getPrimaryInventory(product.id);
  const flags = [];

  if (resolvedLinkStatus.mode === "missing") {
    flags.push({ key: "detail_missing", label: "商品詳細なし", tone: "muted" });
  }
  if (resolvedLinkStatus.mode === "unlinked") {
    flags.push({ key: "needs_link", label: "出品情報を確認", tone: "warning" });
  }
  if (!hasPreviewImage(product)) {
    flags.push({ key: "image_missing", label: "画像未取得", tone: "warning" });
  }
  if (!String(resolvedInventory?.shelfCode || product.storage || "").trim()) {
    flags.push({ key: "storage_missing", label: "棚未設定", tone: "muted" });
  }

  return flags;
}

function hasPriorityReviewFlags(product) {
  return getProductReviewFlags(product).some((flag) => flag.key !== "storage_missing");
}

function matchesReviewFilter(product, filterKey) {
  if (filterKey === "platform_mercari") return getProductPlatforms(product).includes("メルカリ");
  if (filterKey === "platform_yahoo") return getProductPlatforms(product).includes("ヤフオク");
  if (filterKey === "review") return hasPriorityReviewFlags(product);
  return getProductReviewFlags(product).some((flag) => flag.key === filterKey);
}

function getReviewFilterLabel(filterKey = state.reviewFilter) {
  switch (filterKey) {
    case "platform_mercari":
      return "メルカリ";
    case "platform_yahoo":
      return "ヤフオク";
    case "review":
      return "要確認";
    case "detail_missing":
      return "商品詳細なし";
    case "needs_link":
      return "出品情報を確認";
    case "image_missing":
      return "画像未取得";
    case "storage_missing":
      return "棚未設定";
    case "product_missing":
      return "商品情報未入力";
    default:
      return "";
  }
}

function getReviewEmptyMessage() {
  if (elements.searchInput.value.trim()) {
    return state.reviewFilter === "all"
      ? "一致する商品がありません"
      : `${getReviewFilterLabel()} に一致する商品はありません`;
  }
  if (state.reviewFilter === "all") return "まだ商品が登録されていません";
  return `${getReviewFilterLabel()} の商品はありません`;
}

function setReviewFilter(filterKey) {
  const nextFilter = state.reviewFilter === filterKey ? "all" : filterKey;
  state.reviewFilter = nextFilter;

  if (nextFilter === "all") {
    setStatus("絞り込みを解除しました");
  } else {
    const label = getReviewFilterLabel(nextFilter);
    const count = nextFilter === "product_missing"
      ? getLooseInventories().length
      : state.products.filter((product) => matchesReviewFilter(product, nextFilter)).length;
    setStatus(`${label} の商品 ${count} 件だけを表示しています`);
  }

  renderAll();
}

function hasPreviewImage(product) {
  if (Array.isArray(product.photos) && product.photos.some((src) => String(src || "").trim() !== "")) {
    return true;
  }
  return Object.values(product.externalData || {}).some((entry) => String(entry?.imageUrl || "").trim() !== "");
}

function isImportedListing(listing) {
  return Boolean(listing) && (listing.importSource === "listing-summary" || String(listing.lid || "").startsWith("summary:"));
}

function getLinkedListingForProduct(product) {
  const listing = getCanonicalListingForProductId(product.id);
  return hasListingDetailData(listing) ? listing : null;
}

function hasListingDetailData(listing) {
  if (!listing) return false;
  if (Number(listing.price || 0) > 0) return true;

  return [
    listing.platform,
    listing.platformListingId,
    listing.platformUrl,
    listing.description,
    listing.condition,
    listing.brand,
    listing.category,
    listing.listingStatus,
    listing.shipping,
    listing.shippingSize,
  ].some((value) => String(value || "").trim() !== "");
}

function formatListingDetailProductName(product) {
  const title = String(product?.title || "").trim();
  if (!title) {
    return product?.sku || "商品";
  }

  // Guard against malformed imported titles that accidentally contain whole CSV row fragments.
  const firstLine = title.split(/\r?\n/)[0].trim();
  return firstLine.slice(0, 120);
}

function syncListingDetailStatus(linkStatus, productId) {
  elements.listingDetailStatusBadge.className = `link-badge is-${linkStatus.mode}`;
  elements.listingDetailStatusBadge.textContent = linkStatus.label;
  elements.saveListingDetailButton.hidden = false;

  if (linkStatus.mode === "linked") {
    elements.listingDetailStatusText.textContent = "この商品には、保存済みの出品情報があります。";
    elements.listingDetailLinkButton.hidden = true;
    elements.listingDetailLinkButton.onclick = null;
    elements.saveListingDetailButton.textContent = "詳細データを保存";
    return;
  }

  if (linkStatus.mode === "unlinked") {
    elements.listingDetailStatusText.textContent = "取り込んだ出品情報があります。内容がこの商品で合っているか確認してください。";
    elements.listingDetailLinkButton.hidden = false;
    elements.saveListingDetailButton.textContent = "詳細データを保存";
    elements.listingDetailLinkButton.onclick = wrapAsyncAction(async () => {
      await handleConfirmLink(productId);
    });
    return;
  }

  elements.listingDetailStatusText.textContent = "この商品には、まだ商品詳細データがありません。URLなどを入力して保存すると商品詳細を作成できます。";
  elements.listingDetailLinkButton.hidden = true;
  elements.listingDetailLinkButton.onclick = null;
  elements.saveListingDetailButton.textContent = "詳細データを作成して保存";
}

function wrapAsyncAction(handler) {
  return () => {
    Promise.resolve(handler()).catch((error) => {
      console.error("[Listing Assist] Action failed", error);
      setStatus(`処理に失敗しました: ${error.message}`, true);
    });
  };
}

function toggleCheckedProduct(productId, checked) {
  if (checked) {
    state.checkedIds.add(productId);
  } else {
    state.checkedIds.delete(productId);
  }
  updateBulkSelectionControls(getFilteredProducts());
}

function toggleCheckedLooseInventory(inventoryId, checked) {
  if (checked) {
    state.checkedLooseInventoryIds.add(inventoryId);
  } else {
    state.checkedLooseInventoryIds.delete(inventoryId);
  }
  updateBulkSelectionControls(getFilteredLooseInventories());
}

function updateBulkSelectionControls(visibleProducts = getFilteredProducts()) {
  if (state.reviewFilter === "product_missing") {
    const visibleIds = visibleProducts.map((inventory) => inventory.iid);
    const checkedVisibleCount = visibleIds.filter((id) => state.checkedLooseInventoryIds.has(id)).length;
    const totalCheckedCount = state.checkedLooseInventoryIds.size;

    if (elements.selectAllCheckbox) {
      elements.selectAllCheckbox.checked = visibleIds.length > 0 && checkedVisibleCount === visibleIds.length;
      elements.selectAllCheckbox.indeterminate = checkedVisibleCount > 0 && checkedVisibleCount < visibleIds.length;
    }
    if (elements.bulkDeleteButton) {
      elements.bulkDeleteButton.disabled = totalCheckedCount === 0;
      elements.bulkDeleteButton.textContent = totalCheckedCount > 0 ? `選択削除 (${totalCheckedCount})` : "選択削除";
    }
    if (elements.bulkFetchDetailsButton) {
      elements.bulkFetchDetailsButton.disabled = true;
      elements.bulkFetchDetailsButton.textContent = "選択商品の情報を一括取得";
    }
    return;
  }

  const visibleIds = visibleProducts.map((product) => product.id);
  const checkedVisibleCount = visibleIds.filter((id) => state.checkedIds.has(id)).length;
  const totalCheckedCount = state.checkedIds.size;

  if (elements.selectAllCheckbox) {
    elements.selectAllCheckbox.checked = visibleIds.length > 0 && checkedVisibleCount === visibleIds.length;
    elements.selectAllCheckbox.indeterminate = checkedVisibleCount > 0 && checkedVisibleCount < visibleIds.length;
  }

  if (elements.bulkDeleteButton) {
    elements.bulkDeleteButton.disabled = totalCheckedCount === 0;
    elements.bulkDeleteButton.textContent = totalCheckedCount > 0 ? `選択削除 (${totalCheckedCount})` : "選択削除";
  }
  if (elements.bulkFetchDetailsButton) {
    elements.bulkFetchDetailsButton.disabled = totalCheckedCount === 0 || Boolean(state.detailFetchBatch?.active);
    elements.bulkFetchDetailsButton.textContent = totalCheckedCount > 0
      ? `選択商品の情報を一括取得 (${totalCheckedCount})`
      : "選択商品の情報を一括取得";
  }
}

function handleSelectAllChange(event) {
  if (state.reviewFilter === "product_missing") {
    const checked = Boolean(event.target.checked);
    const visibleInventories = getFilteredLooseInventories();
    for (const inventory of visibleInventories) {
      if (checked) {
        state.checkedLooseInventoryIds.add(inventory.iid);
      } else {
        state.checkedLooseInventoryIds.delete(inventory.iid);
      }
    }
    updateBulkSelectionControls(visibleInventories);
    renderProducts();
    return;
  }

  const checked = Boolean(event.target.checked);
  const visibleProducts = getFilteredProducts();
  const visibleIds = visibleProducts.map((product) => product.id);

  for (const product of visibleProducts) {
    if (checked) {
      state.checkedIds.add(product.id);
    } else {
      state.checkedIds.delete(product.id);
    }
  }

  updateBulkSelectionControls(visibleProducts);
  renderProducts();
}

async function deleteProduct(productId) {
  const product = state.products.find((item) => item.id === productId) || null;
  await deleteProductGraph([product].filter(Boolean));
  state.checkedIds.delete(productId);
  if (state.selectedId === productId) {
    state.selectedId = null;
  }
  await loadProducts();
}

async function deleteProducts(productIds) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (ids.length === 0) return;
  const productsToDelete = state.products.filter((product) => ids.includes(product.id));
  await deleteProductGraph(productsToDelete);
  ids.forEach((id) => state.checkedIds.delete(id));
  if (ids.includes(state.selectedId)) {
    state.selectedId = null;
  }
  await loadProducts();
}

async function deleteProductGraph(products) {
  const productList = Array.isArray(products) ? products.filter(Boolean) : [];
  if (productList.length === 0) return;

  const productIds = new Set(productList.map((product) => product.id));
  const relatedListings = state.listings.filter((listing) => productIds.has(listing.pid));
  const relatedInventories = state.inventories.filter((inventory) => productIds.has(inventory.pid));
  const summaryIds = new Set(
    productList
      .flatMap((product) => Object.values(product.externalData || {}))
      .map((entry) => String(entry?.summaryId || "").trim())
      .filter(Boolean),
  );
  relatedListings.forEach((listing) => {
    if (String(listing.lid || "").startsWith("summary:")) {
      summaryIds.add(String(listing.lid).slice("summary:".length));
    }
  });
  const listingIds = new Set(relatedListings.map((listing) => listing.lid));
  summaryIds.forEach((summaryId) => listingIds.add(`summary:${summaryId}`));

  const inventoryManagementIds = new Set(
    productList
      .map((product) => String(product.inventoryManagementId || product.sku || "").trim())
      .filter(Boolean),
  );
  const platformItemKeys = new Set(
    relatedListings
      .map((listing) => buildPlatformItemKeyFromProduct(listing.platform, listing.platformListingId))
      .filter(Boolean),
  );
  productList.forEach((product) => {
    if (product.platformItemKey) platformItemKeys.add(product.platformItemKey);
  });

  const platformLinks = await database.getAll("platformListingLinks");
  const linkIds = platformLinks
    .filter((link) => (
      summaryIds.has(String(link.summaryId || "").trim()) ||
      inventoryManagementIds.has(String(link.inventoryManagementId || "").trim()) ||
      platformItemKeys.has(String(link.platformItemKey || "").trim())
    ))
    .map((link) => link.linkId)
    .filter(Boolean);

  await database.runTransaction(
    ["products", "listings", "inventories", "listingSummaries", "platformListingLinks"],
    "readwrite",
    (stores) => {
      productIds.forEach((id) => stores.products.delete(id));
      listingIds.forEach((listingId) => stores.listings.delete(listingId));
      relatedInventories.forEach((inventory) => stores.inventories.delete(inventory.iid));
      summaryIds.forEach((summaryId) => stores.listingSummaries.delete(summaryId));
      linkIds.forEach((linkId) => stores.platformListingLinks.delete(linkId));
    },
  );
}

async function handleBulkDelete() {
  if (state.reviewFilter === "product_missing") {
    const ids = [...state.checkedLooseInventoryIds];

    if (ids.length === 0) {
      setStatus("削除する商品情報未入力データを選択してください", true);
      return;
    }

    const ok = window.confirm(`選択した ${ids.length} 件の商品情報未入力データを削除しますか？`);
    if (!ok) return;

    await deleteLooseInventories(ids);
    if (elements.selectAllCheckbox) {
      elements.selectAllCheckbox.checked = false;
      elements.selectAllCheckbox.indeterminate = false;
    }
    setStatus(`${ids.length} 件の商品情報未入力データを削除しました`);
    return;
  }

  let ids;
  if (elements.selectAllCheckbox?.checked) {
    ids = getFilteredProducts().map((product) => product.id);
  } else {
    ids = [...state.checkedIds];
  }

  if (ids.length === 0) {
    setStatus("削除する商品を選択してください", true);
    return;
  }

  const ok = window.confirm(`選択した ${ids.length} 件の商品を削除しますか？`);
  if (!ok) return;

  await deleteProducts(ids);
  if (elements.selectAllCheckbox) {
    elements.selectAllCheckbox.checked = false;
    elements.selectAllCheckbox.indeterminate = false;
  }
  setStatus(`${ids.length} 件の商品を削除しました`);
}

async function handleInventorySubmit(event) {
  event.preventDefault();
  const productId = elements.inventoryProductId.value;
  const product = state.products.find((item) => item.id === productId) || null;
  if (!product) {
    setStatus("在庫更新対象の商品が見つかりません", true);
    return;
  }

  const now = new Date().toISOString();
  const inventory = {
    iid: buildPrimaryInventoryId(productId),
    pid: productId,
    shelfCode: elements.inventoryShelfCode.value.trim(),
    linkMemo: elements.inventoryLinkMemo.value.trim(),
    checkedAt: now,
    inputDevice: state.inventoryInputDevice || "pc",
    stock: Number(elements.inventoryStock.value || 0),
    updatedAt: now,
  };

  await inventoryRepository.save(inventory);

  elements.inventoryModal.close();
  await loadProducts();
  setStatus("在庫管理を保存しました");
}

async function handleLooseInventorySubmit(event) {
  event.preventDefault();

  const now = new Date().toISOString();
  const platformUrl = elements.looseInventoryPlatformUrl.value.trim();
  const detectedPlatform = detectPlatformFromListingUrl(platformUrl);
  const detectedPlatformItemId = extractPlatformItemIdFromListingUrl(detectedPlatform, platformUrl);
  const inventory = {
    iid: elements.looseInventoryId.value.trim() || `inventory:unlinked:${crypto.randomUUID()}`,
    pid: "",
    title: elements.looseInventoryTitle.value.trim(),
    platform: detectedPlatform,
    platformItemId: detectedPlatformItemId,
    platformUrl,
    shelfCode: elements.looseInventoryShelfCode.value.trim(),
    linkMemo: elements.looseInventoryLinkMemo.value.trim(),
    checkedAt: now,
    inputDevice: elements.looseInventoryInputDevice.value.trim() || "pc",
    stock: Number(elements.looseInventoryStock.value || 0),
    fetchedDetail: state.looseInventoryFetchedDetail || null,
    updatedAt: now,
  };

  try {
    const result = await promoteLooseInventoryPayload(inventory, {
      editAfter: false,
      sourceInventoryId: elements.looseInventoryId.value.trim() || "",
      skipConfirm: true,
    });
    populateLooseInventoryForm();
    elements.looseInventoryModal?.close();
    state.looseInventoryFetchedDetail = null;
    setStatus(`商品「${result.title || result.sku || "商品"}」を保存しました`);
  } catch (error) {
    await inventoryRepository.save(inventory);
    await loadProducts();
    renderLooseInventoryModalState();
    setStatus(`自動商品登録に失敗したため、未紐付け在庫に退避しました: ${error.message}`, true);
  }
}

async function deleteLooseInventory(inventoryId) {
  const inventory = state.inventories.find((item) => item.iid === inventoryId) || null;
  if (!inventory) {
    setStatus("削除対象の未紐付け在庫が見つかりません", true);
    return;
  }

  const ok = window.confirm(`${inventory.title || inventory.shelfCode || "この未紐付け在庫"} を削除しますか？`);
  if (!ok) return;

  await inventoryRepository.delete(inventoryId);
  state.checkedLooseInventoryIds.delete(inventoryId);
  if (elements.looseInventoryId.value === inventoryId) {
    populateLooseInventoryForm();
  }
  await loadProducts();
  renderLooseInventoryModalState();
  setStatus("未紐付け在庫を削除しました");
}

async function deleteLooseInventories(inventoryIds) {
  const ids = [...new Set(inventoryIds)].filter(Boolean);
  if (ids.length === 0) return;

  const looseInventoryIds = new Set(
    state.inventories
      .filter((inventory) => !String(inventory?.pid || "").trim())
      .map((inventory) => inventory.iid),
  );
  const deletableIds = ids.filter((id) => looseInventoryIds.has(id));
  if (deletableIds.length !== ids.length) {
    throw new Error("削除対象に商品マスターへ紐付いた在庫が含まれているため処理を中止しました");
  }

  await database.runTransaction(["inventories"], "readwrite", (stores) => {
    deletableIds.forEach((id) => stores.inventories.delete(id));
  });
  deletableIds.forEach((id) => state.checkedLooseInventoryIds.delete(id));
  if (deletableIds.includes(elements.looseInventoryId.value)) {
    populateLooseInventoryForm();
  }
  await loadProducts();
  renderLooseInventoryModalState();
}

async function promoteLooseInventoryToProduct(inventoryId, { editAfter = false } = {}) {
  const inventory = state.inventories.find((item) => item.iid === inventoryId && !String(item?.pid || "").trim()) || null;
  if (!inventory) {
    setStatus("商品登録対象の未紐付け在庫が見つかりません", true);
    return;
  }
  const product = await promoteLooseInventoryPayload(inventory, {
    editAfter,
    sourceInventoryId: inventory.iid,
    skipConfirm: true,
  });
  setStatus(`未紐付け在庫から「${product.title || product.sku || "商品"}」を再登録しました`);
}

async function promoteLooseInventoryPayload(inventory, { editAfter = false, sourceInventoryId = "", skipConfirm = false } = {}) {
  if (!String(inventory.title || "").trim() && !String(inventory.platformUrl || "").trim()) {
    throw new Error("商品タイトルか販売ページURLを入れてください");
  }

  const matchedListing = findImportedListingForLooseInventory(inventory);
  const existingProduct = findExistingProductForLooseInventory(inventory);

  if (existingProduct) {
    if (!skipConfirm) {
      const ok = window.confirm(`既存商品「${existingProduct.title || existingProduct.sku || "この商品"}」に在庫情報を反映しますか？`);
      if (!ok) {
        throw new Error("既存商品への反映をキャンセルしました");
      }
    }
    return mergeLooseInventoryIntoProduct(existingProduct, inventory, matchedListing, { editAfter, sourceInventoryId });
  }

  if (!skipConfirm) {
    const ok = window.confirm(`${inventory.title || "この未紐付け在庫"} を商品マスターへ登録しますか？`);
    if (!ok) {
      throw new Error("商品登録をキャンセルしました");
    }
  }

  const now = new Date().toISOString();
  const product = buildProductFromLooseInventory(inventory, matchedListing, now);
  const listing = buildListingForPromotedProduct(product, matchedListing, now);

  const promotedInventory = buildInventoryFromLooseInventory(product, inventory, now);
  await savePromotedInventoryTransaction({
    product,
    listing,
    inventory: promotedInventory,
    previousListingId: matchedListing?.lid || "",
    sourceInventoryId,
  });

  state.selectedId = product.id;
  await loadProducts();
  renderLooseInventoryModalState();

  if (editAfter) {
    elements.looseInventoryModal?.close();
    openModalForEdit(product.id);
  }

  return product;
}

async function mergeLooseInventoryIntoProduct(existingProduct, inventory, matchedListing = null, { editAfter = false, sourceInventoryId = "" } = {}) {
  const now = new Date().toISOString();
  const mergedProduct = buildMergedProductFromLooseInventory(existingProduct, inventory, matchedListing, now);
  const listing = buildListingForPromotedProduct(mergedProduct, matchedListing, now);

  const promotedInventory = buildInventoryFromLooseInventory(mergedProduct, inventory, now);
  await savePromotedInventoryTransaction({
    product: mergedProduct,
    listing,
    inventory: promotedInventory,
    previousListingId: matchedListing?.lid || "",
    sourceInventoryId,
  });
  state.selectedId = mergedProduct.id;
  await loadProducts();
  renderLooseInventoryModalState();

  if (editAfter) {
    elements.looseInventoryModal?.close();
    openModalForEdit(mergedProduct.id);
  }

  return mergedProduct;
}

async function savePromotedInventoryTransaction({
  product,
  listing,
  inventory,
  previousListingId = "",
  sourceInventoryId = "",
}) {
  await database.runTransaction(["products", "listings", "inventories"], "readwrite", (stores) => {
    stores.products.put(buildProductMasterRecord(product));
    stores.listings.put(listing);
    stores.inventories.put(inventory);

    if (previousListingId && previousListingId !== listing.lid) {
      stores.listings.delete(previousListingId);
    }

    if (sourceInventoryId && sourceInventoryId !== inventory.iid) {
      stores.inventories.delete(sourceInventoryId);
    }
  });
}

function handleListingDetailUrlChange() {
  const url = elements.listingDetailPlatformUrl.value.trim();
  if (!url) return;

  const detectedPlatform = detectPlatformFromListingUrl(url);
  const detectedPlatformItemId = extractPlatformItemIdFromListingUrl(detectedPlatform, url);

  if (detectedPlatform && !elements.listingDetailPlatform.value.trim()) {
    elements.listingDetailPlatform.value = detectedPlatform;
  }

  if (detectedPlatformItemId && !elements.listingDetailPlatformItemId.value.trim()) {
    elements.listingDetailPlatformItemId.value = detectedPlatformItemId;
  }
}

async function handleListingDetailSubmit(event) {
  event.preventDefault();
  await saveListingDetail({ linkAfterSave: false });
}

async function saveListingDetail({ linkAfterSave = false } = {}) {
  const productId = elements.listingDetailProductId.value;
  const product = state.products.find((item) => item.id === productId) || null;
  if (!product) {
    setStatus("商品詳細保存対象の商品が見つかりません", true);
    return null;
  }

  const rawUrl = elements.listingDetailPlatformUrl.value.trim();
  const manualPlatform = elements.listingDetailPlatform.value.trim();
  const detectedPlatform = detectPlatformFromListingUrl(rawUrl);
  const platform = manualPlatform || detectedPlatform;
  const detectedPlatformItemId = extractPlatformItemIdFromListingUrl(platform, rawUrl);
  const platformListingId = elements.listingDetailPlatformItemId.value.trim() || detectedPlatformItemId;
  const now = new Date().toISOString();
  const existingListingId = elements.listingDetailListingId.value.trim();
  const currentMode = elements.listingDetailLinkMode.value.trim();
  const pid = linkAfterSave || currentMode === "linked" || currentMode === "missing" ? product.id : "";
  const lid = existingListingId || buildPrimaryListingId(product.id);

  const fetchedDetail = state.listingDetailFetchedDetail || {};
  const existingListing = state.listings.find((item) => item.lid === lid) || null;
  const listing = {
    ...(existingListing || {}),
    lid,
    pid,
    platform,
    platformListingId,
    platformUrl: rawUrl,
    imageUrl: fetchedDetail.imageUrl || fetchedDetail.imageUrls?.[0] || existingListing?.imageUrl || product.photos?.[0] || "",
    brand: fetchedDetail.brand || existingListing?.brand || product.brand || "",
    category: fetchedDetail.category || existingListing?.category || product.category || "",
    description: elements.listingDetailDescription.value.trim(),
    condition: elements.listingDetailCondition.value.trim(),
    price: Number(elements.listingDetailPrice.value || 0),
    importedAt: now,
    importSource: existingListingId && currentMode === "unlinked" ? "listing-summary" : "manual",
    linkState: pid ? "confirmed" : "unlinked",
    listingStatus: existingListing?.listingStatus || product.listingStatus || "",
    shipping: fetchedDetail.shipping || existingListing?.shipping || product.shipping || "",
    shippingSize: fetchedDetail.shippingSize || existingListing?.shippingSize || product.shippingSize || "",
    tags: Array.isArray(existingListing?.tags) ? [...existingListing.tags] : [],
    updatedAt: now,
  };

  await listingRepository.save(listing);

  if (elements.listingDetailModal?.open) {
    elements.listingDetailModal.close();
  }
  state.listingDetailFetchedDetail = null;

  await loadProducts();
  setStatus(linkAfterSave ? "この商品の出品情報として保存しました。" : "商品詳細を保存しました。");
  return listing;
}

async function handleConfirmLink(productId) {
  const product = state.products.find((item) => item.id === productId) || null;
  if (!product) {
    setStatus("保存先の商品が見つかりません", true);
    return;
  }

  const linkStatus = getProductLinkStatus(product);
  if (linkStatus.mode !== "unlinked" || !linkStatus.listing) {
    setStatus("この商品には確認待ちの出品情報がありません", true);
    return;
  }

  const ok = window.confirm(`${product.title || "この商品"} の出品情報として保存しますか？`);
  if (!ok) return;
  elements.listingDetailProductId.value = product.id;
  elements.listingDetailListingId.value = linkStatus.listing.lid;
  elements.listingDetailLinkMode.value = linkStatus.mode;
  await saveListingDetail({ linkAfterSave: true });
}

async function handleConfirmVisibleLinks() {
  const visibleProducts = getFilteredProducts();
  const visibleMissingProducts = visibleProducts.filter((product) => getProductLinkStatus(product).mode === "missing");
  const visibleUnresolvedProducts = visibleProducts.filter((product) => getProductLinkStatus(product).mode === "unlinked");
  const allMissingProducts = state.products.filter((product) => getProductLinkStatus(product).mode === "missing");
  const allUnresolvedProducts = state.products.filter((product) => getProductLinkStatus(product).mode === "unlinked");

  if (allMissingProducts.length === 0 && allUnresolvedProducts.length === 0) {
    setStatus("商品詳細なし・出品情報の確認待ちの行はありません");
    return;
  }

  if (visibleMissingProducts.length === 0 && visibleUnresolvedProducts.length === 0) {
    setStatus(
      `全体では 商品詳細なし ${allMissingProducts.length} 件 / 出品情報を確認 ${allUnresolvedProducts.length} 件あります。検索条件のため現在の一覧には表示されていません。`,
    );
    return;
  }

  if (visibleUnresolvedProducts.length === 0) {
    setStatus(
      `現在表示中の要確認は 商品詳細なし ${visibleMissingProducts.length} 件のみです。これらは個別に内容確認が必要です。`,
    );
    return;
  }

  const confirmationLines = [
    `現在表示中の「出品情報を確認」 ${visibleUnresolvedProducts.length} 件を、この商品の詳細データとして一括保存します。`,
    "一覧に見えている確認待ちだけが対象です。",
  ];
  if (visibleMissingProducts.length > 0) {
    confirmationLines.push(`「商品詳細なし」 ${visibleMissingProducts.length} 件は対象外のまま残します。`);
  }
  confirmationLines.push("元のCSV取り込み行は、商品ごとの主データへ置き換わります。");

  const ok = window.confirm(confirmationLines.join("\n"));
  if (!ok) {
    setStatus("一括確定をキャンセルしました。");
    return;
  }

  const now = new Date().toISOString();
  const confirmedListings = [];
  const supersededListingIds = [];
  for (const product of visibleUnresolvedProducts) {
    const linkStatus = getProductLinkStatus(product);
    const sourceListing = linkStatus.listing;
    if (!sourceListing) continue;
    const nextListingId = buildPrimaryListingId(product.id);
    confirmedListings.push({
      ...sourceListing,
      lid: nextListingId,
      pid: product.id,
      linkState: "confirmed",
      updatedAt: now,
    });
    if (sourceListing.lid && sourceListing.lid !== nextListingId) {
      supersededListingIds.push(sourceListing.lid);
    }
  }

  await database.runTransaction(["listings"], "readwrite", (stores) => {
    confirmedListings.forEach((listing) => stores.listings.put(listing));
    supersededListingIds.forEach((listingId) => stores.listings.delete(listingId));
  });

  await loadProducts();
  setStatus(
    `表示中の出品情報 ${confirmedListings.length} 件を一括で確定しました。${
      visibleMissingProducts.length > 0 ? `商品詳細なし ${visibleMissingProducts.length} 件は未処理のままです。` : ""
    }`,
  );
}

function resetForm() {
  populateForm(null);
}

async function handleDuplicate() {
  const current = getSelectedProduct();
  if (!current) {
    setStatus("複製する商品を選択してください", true);
    return;
  }

  const copy = {
    ...current,
    id: crypto.randomUUID(),
    sku: `${current.sku}-COPY`,
    inventoryManagementId: "",
    platformItemId: "",
    platformItemKey: "",
    itemUrl: "",
    editUrl: "",
    listingStatus: "",
    latestImportId: "",
    latestImportAt: "",
    externalData: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await upsertProduct(copy);
  state.selectedId = copy.id;
  populateForm(copy);
  setStatus("商品を複製しました");
}

async function handleMercariAssist(product) {
  try {
    const payload = buildMercariPayload(product);
    const textOnlyPayload = buildMercariPayload(product, { includePhotos: false });
    const encodedPayload = `${MERCARI_PAYLOAD_PREFIX}${JSON.stringify(payload)}`;
    const mercariUrl = `${MERCARI_SELL_URL}#${MERCARI_HASH_KEY}=${encodeURIComponent(encodePayload(textOnlyPayload))}`;
    const mercariWindow = window.open("", "_blank");

    if (mercariWindow) {
      mercariWindow.name = encodedPayload;
      mercariWindow.location.href = mercariUrl;
      setStatus("メルカリ出品画面へ補助データを渡しました");
      return;
    }

    await navigator.clipboard.writeText(encodedPayload);
    window.open(mercariUrl, "_blank", "noopener");
    setStatus("ポップアップが使えないため、補助データをコピーしてメルカリ出品画面を開きました");
  } catch (error) {
    setStatus(`メルカリ補助データの準備に失敗しました: ${error.message}`, true);
  }
}

async function handleYahooAuctionAssist(product) {
  try {
    const payload = buildYahooAuctionPayload(product);
    const textOnlyPayload = buildYahooAuctionPayload(product, { includePhotos: false });
    const encodedPayload = `${YAHOO_AUCTION_PAYLOAD_PREFIX}${JSON.stringify(payload)}`;
    const yahooUrl =
      `${YAHOO_AUCTION_SELL_URL}#${YAHOO_AUCTION_HASH_KEY}=${encodeURIComponent(encodePayload(textOnlyPayload))}`;
    const yahooWindow = window.open("", "_blank");

    if (yahooWindow) {
      yahooWindow.name = encodedPayload;
      yahooWindow.location.href = yahooUrl;
      setStatus("ヤフオク出品画面へ補助データを渡しました");
      return;
    }

    await navigator.clipboard.writeText(encodedPayload);
    window.open(yahooUrl, "_blank", "noopener");
    setStatus("ポップアップが使えないため、補助データをコピーしてヤフオク出品画面を開きました");
  } catch (error) {
    setStatus(`ヤフオク補助データの準備に失敗しました: ${error.message}`, true);
  }
}

async function exportJson({ mode = "manual-local-export" } = {}) {
  const payload = await database.exportSnapshot(buildBackupMeta(mode));
  const fileName = buildBackupFileName(mode, payload.exportedAt);
  const text = JSON.stringify(payload, null, 2);
  downloadFile(fileName, text, "application/json");
  updateSyncHistoryAfterExport({
    exportedAt: payload.exportedAt,
    fileName,
    mode,
  });
  const counts = payload.meta?.counts || {};
  const prefix = mode === "manual-drive-save" ? "Drive共有用JSONを保存しました" : "JSONバックアップを保存しました";
  setStatus(`${prefix}（商品 ${counts.products || 0} / 詳細 ${counts.listings || 0} / 在庫 ${counts.inventories || 0}）`);
}

async function exportCsv() {
  const header = ["id", "sku", "title", "brand", "category", "condition", "price", "platform", "stock", "storage", "shipping", "shippingSize", "tags", "description", "memo", "updatedAt"];
  const lines = [
    header.join(","),
    ...state.products.map((product) => header.map((key) => escapeCsv(getCsvValue(product, key))).join(",")),
  ];
  downloadFile("listing-assist-products.csv", lines.join("\n"), "text/csv;charset=utf-8;");
  setStatus("CSVを保存しました");
}

async function handleImportCsvSelection(event) {
  const [file] = Array.from(event.target.files || []);

  if (!file) {
    updateImportCsvControlState();
    return;
  }

  await importCsv();
}

function updateImportCsvControlState() {
  const selectedFile = elements.importCsvInput?.files?.[0] || null;
  if (elements.selectImportCsvButton) {
    elements.selectImportCsvButton.disabled = state.importInProgress;
    elements.selectImportCsvButton.textContent = state.importInProgress
    ? "CSVを読み込み中..."
    : "CSVを選んで読み込む";
  }
  if (elements.selectedCsvFileName) {
    elements.selectedCsvFileName.textContent = selectedFile
      ? `${state.importInProgress ? "読み込み中" : "選択中"}: ${selectedFile.name}`
      : "ファイルを選択すると、そのまま読み込みを開始します。";
  }
}

async function importCsv() {
  const file = elements.importCsvInput?.files?.[0] || null;
  if (!file) {
    setStatus("先にCSVファイルを選択してください", true);
    showCsvImportModal({
      title: "CSV読み込みエラー",
      body: "先にCSVファイルを選択してください。",
      meta: "ファイル未選択のため、読み込みを開始していません。",
      tone: "error",
    });
    return;
  }

  try {
    state.importInProgress = true;
    updateImportCsvControlState();
    console.info("[Listing Assist] CSV import start", {
      fileName: file.name,
      platformHint: elements.csvPlatformHint?.value || "",
    });
    setStatus("CSVを読み込み中です...");
    showCsvImportModal({
      title: "CSVを読み込み中です",
      body: `一覧CSVを取り込み中です: ${file.name}`,
      meta: [
        `ファイル名: ${file.name}`,
        `プラットフォーム指定: ${elements.csvPlatformHint?.value || "自動判定"}`,
        "処理状態: 読み込み開始",
      ].join("\n"),
      tone: "progress",
    });
    const csvText = await file.text();
    const result = await listingImportService.importCsv({
      fileName: file.name,
      csvText,
      platformHint: elements.csvPlatformHint?.value || "",
    });

    elements.importCsvInput.value = "";
    updateImportCsvControlState();
    await loadProducts();

    const warningSuffix = result.warnings.length > 0 ? ` / 警告 ${result.warnings.length}件` : "";
    console.info("[Listing Assist] CSV import success", result);
    setStatus(`${result.platform || "CSV"} の一覧を ${result.importedProducts} 件取り込みました${warningSuffix}`);
    showCsvImportModal({
      title: "CSV読み込みが完了しました",
      body: `${result.platform || "CSV"} の一覧を ${result.importedProducts} 件取り込みました${warningSuffix}`,
      meta: [
        `ファイル名: ${file.name}`,
        `検出プラットフォーム: ${result.platform || "未判定"}`,
        `読み込み行数: ${result.totalRows}件`,
        `登録件数: ${result.importedProducts}件`,
        result.warnings.length > 0 ? `警告: ${result.warnings.join(" / ")}` : "警告: なし",
      ].join("\n"),
      tone: "success",
    });
    if (result.warnings.length > 0) {
      console.warn("[Listing Assist][CSV Import Warnings]", result.warnings);
    }
  } catch (error) {
    console.error("[Listing Assist] CSV import failed", error);
    setStatus(`CSV読み込みに失敗しました: ${error.message}`, true);
    showCsvImportModal({
      title: "CSV読み込みに失敗しました",
      body: `エラー: ${error.message}`,
      meta: [
        `ファイル名: ${file.name}`,
        `プラットフォーム指定: ${elements.csvPlatformHint?.value || "自動判定"}`,
        `エラー詳細: ${error.stack || error.message}`,
      ].join("\n"),
      tone: "error",
    });
  } finally {
    state.importInProgress = false;
    updateImportCsvControlState();
  }
}

async function importJson(event) {
  const [file] = Array.from(event.target.files || []);
  if (!file) return;

  try {
    const text = await file.text();
    elements.importJsonInput.value = "";
    await importBackupText(text, {
      sourceName: file.name,
    });
  } catch (error) {
    setStatus(buildJsonImportErrorMessage(error), true);
  }
}

async function importBackupText(text, { sourceName = "", fallbackExportedAt = "" } = {}) {
  const payload = JSON.parse(text);
  const normalizedBackup = normalizeBackupPayload(payload);
  if (!normalizedBackup.exportedAt && fallbackExportedAt) {
    normalizedBackup.exportedAt = fallbackExportedAt;
  }
  if (normalizedBackup.exportedAt && Number.isNaN(new Date(normalizedBackup.exportedAt).getTime())) {
    throw new Error("バックアップ日時 exportedAt の形式が正しくありません");
  }

  const shouldContinue = await confirmBeforeBackupImport(normalizedBackup, sourceName);
  if (!shouldContinue) {
    setStatus("バックアップの読み込みをキャンセルしました");
    return { imported: false };
  }

  await database.replaceSnapshot({
    products: normalizedBackup.stores.products,
    listings: normalizedBackup.stores.listings,
    inventories: normalizedBackup.stores.inventories,
    rawImports: normalizedBackup.stores.rawImports,
    listingSummaries: normalizedBackup.stores.listingSummaries,
    platformListingLinks: normalizedBackup.stores.platformListingLinks,
  });

  await loadProducts();
  const counts = summarizeBackupCounts(normalizedBackup);
  updateSyncHistoryAfterImport(normalizedBackup, counts, sourceName);
  const sourceDeviceName = getImportedSourceLabel(normalizedBackup, sourceName);
  const sourceDevice = sourceDeviceName ? ` / 保存元 ${sourceDeviceName}` : "";
  setStatus(`JSONバックアップを読み込みました（商品 ${counts.products} / 詳細 ${counts.listings} / 在庫 ${counts.inventories}${sourceDevice}）`);
  return { imported: true, backup: normalizedBackup, counts };
}

function buildJsonImportErrorMessage(error) {
  const message = String(error?.message || "");

  if (message.includes("Unexpected token") || message.includes("JSON")) {
    return "JSONの形式が正しくありません。書き出したバックアップファイルをそのまま選んでいるか確認してください。";
  }

  if (message.includes("products / listings / inventories")) {
    return "このJSONは対応しているバックアップ形式ではありません。商品・詳細・在庫の3系統が入ったバックアップを選んでください。";
  }

  return `読み込みに失敗しました: ${message}`;
}

async function uploadJsonToDrive() {
  const payload = await database.exportSnapshot(buildBackupMeta("drive-api-save"));
  const fileName = buildBackupFileName("manual-drive-save", payload.exportedAt);
  const token = await ensureDriveAccessToken();
  const currentFileId = extractDriveFileId(state.syncSettings.driveFileId);
  const folderId = extractDriveFolderId(state.syncSettings.driveFolderId);
  let currentDriveMetadata = null;
  if (currentFileId) {
    currentDriveMetadata = await fetchDriveFileMetadata(token, currentFileId);
    const identity = await verifyDriveBackupFile(token, currentFileId, currentDriveMetadata);
    const shouldContinue = await confirmBeforeDriveOverwrite(currentDriveMetadata, currentFileId, identity);
    if (!shouldContinue) {
      setStatus("Drive保存をキャンセルしました");
      showDriveOperationModal({
        title: "Driveへの保存をキャンセルしました",
        body: "Drive上のファイルは変更されていません。",
        meta: [
          `対象ファイル: ${currentDriveMetadata.name || "名称未取得"}`,
          `ファイルID: ${currentFileId}`,
        ].join("\n"),
        tone: "neutral",
      });
      return;
    }
  }
  const metadata = {
    name: currentFileId ? undefined : fileName,
    mimeType: "application/json",
    appProperties: {
      listingAssistBackup: "true",
      backupFormat: BACKUP_FORMAT,
      schemaVersion: String(BACKUP_SCHEMA_VERSION),
    },
  };

  if (!currentFileId && folderId) {
    metadata.parents = [folderId];
  }

  const body = buildDriveMultipartBody(metadata, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  if (currentFileId && currentDriveMetadata) {
    const latestMetadata = await fetchDriveFileMetadata(token, currentFileId);
    const expectedVersion = String(currentDriveMetadata.version || currentDriveMetadata.modifiedTime || "");
    const latestVersion = String(latestMetadata.version || latestMetadata.modifiedTime || "");
    if (expectedVersion && latestVersion && expectedVersion !== latestVersion) {
      throw new Error("確認中にDrive上のバックアップが更新されました。Driveから読み込んで内容を確認してから、もう一度保存してください");
    }
  }
  const url = currentFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(currentFileId)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,modifiedTime";
  const method = currentFileId ? "PATCH" : "POST";
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${body.boundary}`,
    },
    body: body.payload,
  });

  const result = await parseDriveJsonResponse(response);
  state.syncSettings.driveFileId = result.id || currentFileId || "";
  if (elements.driveFileId) {
    elements.driveFileId.value = state.syncSettings.driveFileId;
  }
  writeJsonStorage(SYNC_SETTINGS_STORAGE_KEY, state.syncSettings);
  updateSyncHistoryAfterExport({
    exportedAt: payload.exportedAt,
    fileName: result.name || fileName,
    mode: "drive-api-save",
    driveFileId: state.syncSettings.driveFileId,
    driveModifiedAt: result.modifiedTime || currentDriveMetadata?.modifiedTime || "",
  });
  const counts = payload.meta?.counts || {};
  const createdOrUpdated = currentFileId ? "更新" : "新規保存";
  setStatus(`Driveへ${createdOrUpdated}しました（商品 ${counts.products || 0} / 詳細 ${counts.listings || 0} / 在庫 ${counts.inventories || 0} / ファイルID ${state.syncSettings.driveFileId}）`);
  showDriveOperationModal({
    title: "Driveへの保存が完了しました",
    body: `Driveへ${createdOrUpdated}しました。`,
    meta: [
      `対象ファイル: ${result.name || fileName}`,
      `商品: ${counts.products || 0}件`,
      `詳細: ${counts.listings || 0}件`,
      `在庫: ${counts.inventories || 0}件`,
      `ファイルID: ${state.syncSettings.driveFileId}`,
      `保存日時: ${formatDateTime(payload.exportedAt)}`,
    ].join("\n"),
    tone: "success",
  });
  renderDriveSyncInfo();
}

async function importJsonFromDrive() {
  const token = await ensureDriveAccessToken();
  const fileId = extractDriveFileId(state.syncSettings.driveFileId);
  if (!fileId) {
    throw new Error("DriveファイルIDまたは共有URLを入力してください");
  }

  const metadata = await fetchDriveFileMetadata(token, fileId);

  const contentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!contentResponse.ok) {
    throw new Error(await buildDriveErrorMessage(contentResponse));
  }

  const text = await contentResponse.text();
  state.syncSettings.driveFileId = fileId;
  if (elements.driveFileId) {
    elements.driveFileId.value = fileId;
  }
  writeJsonStorage(SYNC_SETTINGS_STORAGE_KEY, state.syncSettings);
  const importResult = await importBackupText(text, {
    sourceName: metadata.name || `${DRIVE_DISCOVERY_SOURCE_LABEL}-${fileId}.json`,
    fallbackExportedAt: metadata.modifiedTime || "",
  });
  if (!importResult?.imported) {
    showDriveOperationModal({
      title: "Driveからの読み込みをキャンセルしました",
      body: "端末内のデータは変更されていません。",
      meta: [
        `対象ファイル: ${metadata.name || "名称未取得"}`,
        `ファイルID: ${fileId}`,
      ].join("\n"),
      tone: "neutral",
    });
    return;
  }
  state.syncHistory.lastKnownDriveFileId = fileId;
  state.syncHistory.lastKnownDriveModifiedAt = String(metadata.modifiedTime || "");
  writeJsonStorage(SYNC_HISTORY_STORAGE_KEY, state.syncHistory);
  const counts = importResult.counts || {};
  const sourceDeviceName = String(importResult.backup?.meta?.deviceName || "").trim();
  showDriveOperationModal({
    title: "Driveからの読み込みが完了しました",
    body: "Drive上のバックアップを端末へ反映しました。",
    meta: [
      `対象ファイル: ${metadata.name || "名称未取得"}`,
      `商品: ${counts.products || 0}件`,
      `詳細: ${counts.listings || 0}件`,
      `在庫: ${counts.inventories || 0}件`,
      sourceDeviceName ? `保存元端末: ${sourceDeviceName}` : "保存元端末: 未設定",
      `バックアップ日時: ${formatDateTime(importResult.backup?.exportedAt || metadata.modifiedTime)}`,
      `ファイルID: ${fileId}`,
    ].join("\n"),
    tone: "success",
  });
  renderDriveSyncInfo();
}

async function fetchDriveFileMetadata(token, fileId) {
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,version,webViewLink,mimeType,appProperties&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return await parseDriveJsonResponse(metadataResponse);
}

async function verifyDriveBackupFile(token, fileId, metadata) {
  const appProperties = isPlainObject(metadata?.appProperties) ? metadata.appProperties : {};
  if (appProperties.listingAssistBackup === "true" && appProperties.backupFormat === BACKUP_FORMAT) {
    return { verified: true, source: "app-properties" };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(await buildDriveErrorMessage(response));
  }

  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch (_error) {
    throw new Error("指定したDriveファイルはJSONとして読めないため、上書きしませんでした");
  }

  try {
    normalizeBackupPayload(payload);
  } catch (error) {
    throw new Error(`指定したDriveファイルをListing Assistのバックアップとして確認できません: ${error.message}`);
  }

  return { verified: true, source: "backup-content" };
}

async function ensureDriveAccessToken() {
  const clientId = String(state.syncSettings.driveClientId || "").trim();
  if (!clientId) {
    throw new Error("Google OAuthクライアントIDを入力してください");
  }

  const now = Date.now();
  if (state.driveAuth.accessToken && state.driveAuth.expiresAt > now + 60_000) {
    return state.driveAuth.accessToken;
  }

  const oauth = globalThis.google?.accounts?.oauth2;
  if (!oauth) {
    throw new Error("Google認証ライブラリの読み込みに失敗しました。画面を再読み込みしてください");
  }

  if (!state.driveAuth.tokenClient || state.driveAuth.clientId !== clientId) {
    state.driveAuth.tokenClient = oauth.initTokenClient({
      client_id: clientId,
      scope: DRIVE_API_SCOPE,
      callback: () => {},
    });
    state.driveAuth.clientId = clientId;
  }

  return await new Promise((resolve, reject) => {
    state.driveAuth.tokenClient.callback = (response) => {
      if (!response?.access_token) {
        reject(new Error("Google Driveのアクセストークンを取得できませんでした"));
        return;
      }

      state.driveAuth.accessToken = response.access_token;
      state.driveAuth.expiresAt = Date.now() + Number(response.expires_in || 0) * 1000;
      resolve(response.access_token);
    };
    state.driveAuth.tokenClient.error_callback = (error) => {
      reject(new Error(`Google認証に失敗しました: ${error.type || "unknown"}`));
    };
    state.driveAuth.tokenClient.requestAccessToken({
      prompt: state.driveAuth.accessToken ? "" : "consent",
    });
  });
}

function buildDriveMultipartBody(metadata, content, mimeType) {
  const boundary = `listing-assist-${crypto.randomUUID()}`;
  const sanitizedMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  const payload = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(sanitizedMetadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return {
    boundary,
    payload,
  };
}

async function parseDriveJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(extractDriveErrorMessage(text) || `${response.status} ${response.statusText}`);
  }

  return text ? JSON.parse(text) : {};
}

async function buildDriveErrorMessage(response) {
  const text = await response.text();
  return extractDriveErrorMessage(text) || `${response.status} ${response.statusText}`;
}

function extractDriveErrorMessage(text) {
  try {
    const data = JSON.parse(text);
    return data?.error?.message || "";
  } catch (error) {
    return String(text || "");
  }
}

async function seedSampleData() {
  if (state.products.length > 0) {
    const ok = window.confirm("既存データがあります。サンプルを追加しますか？");
    if (!ok) return;
  }

  const now = new Date().toISOString();
  const samples = [
      {
        id: crypto.randomUUID(),
        sku: "EKW-001",
        title: "テスト用 リネン混ギャザーワンピース",
        brand: "Samansa Mos2",
        category: "ファッション > レディース > ワンピース > その他",
        condition: "目立った傷や汚れなし",
        storage: "棚A-2",
        price: 2480,
        platform: "メルカリ",
        stock: 1,
        shipping: "ゆうパケットポスト",
        tags: ["ナチュラル", "夏物", "人気"],
        description:
          "やわらかいリネン混素材です。軽い着用感があり、日常使いしやすい一枚です。",
        memo: "ヤフオク転記テスト用: ゆうパケットポスト -> ゆうパケット確認",
        photos: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        sku: "EKW-002",
        title: "テスト用 陶器の小花プレート 2枚セット",
        brand: "ノーブランド",
        category: "キッチン・日用品・その他 > キッチン・食器 > 食器 > 皿・プレート",
        condition: "やや傷や汚れあり",
        storage: "棚C-1",
        price: 1680,
        platform: "ヤフオク",
        stock: 2,
        shipping: "宅急便",
        shippingSize: "80",
        tags: ["雑貨", "食器", "セット"],
        description:
          "小花柄の陶器プレートです。普段使いにちょうどよく、取り皿として使いやすいサイズ感です。",
        memo: "ヤフオク転記テスト用: 宅急便 80サイズ自動選択確認",
        photos: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        sku: "EKW-003",
        title: "テスト用 大型ブランケット まとめ売り",
        brand: "ノーブランド",
        category: "家具・インテリア > 寝具 > 布団・毛布 > 毛布・ブランケット",
        condition: "目立った傷や汚れなし",
        storage: "棚D-3",
        price: 3980,
        platform: "ヤフオク",
        stock: 1,
        shipping: "宅急便",
        shippingSize: "180",
        tags: ["大判", "まとめ売り"],
        description:
          "大きめサイズのブランケットをまとめたテスト用データです。ヤフオクでは180サイズ以上の自動見送り確認に使います。",
        memo: "ヤフオク転記テスト用: 宅急便 180サイズは重量未設定のため見送り確認",
        photos: [],
        createdAt: now,
        updatedAt: now,
      },
  ];

  const looseInventories = [
    {
      iid: `inventory:unlinked:${crypto.randomUUID()}`,
      pid: "",
      shelfCode: "棚Z-1",
      linkMemo: "スマホ先行入力テスト。花柄ワンピースっぽいもの。",
      checkedAt: now,
      inputDevice: "smartphone",
      stock: 1,
      updatedAt: now,
    },
    {
      iid: `inventory:unlinked:${crypto.randomUUID()}`,
      pid: "",
      shelfCode: "棚Z-2",
      linkMemo: "QR読取テスト。食器2点セット。あとで商品マスターと紐づけ予定。",
      checkedAt: now,
      inputDevice: "qr",
      stock: 2,
      updatedAt: now,
    },
  ];

  const unlinkedProductId = crypto.randomUUID();
  const unlinkedPlatformItemId = `MRC-SAMPLE-${Date.now()}`;
  const unlinkedProduct = {
    id: unlinkedProductId,
    sku: "EKW-UNLINK-001",
    title: "出品情報確認用 コットンブラウス",
    brand: "サンプルブランド",
    category: "ファッション > レディース > トップス > シャツ・ブラウス",
    condition: "",
    storage: "棚U-1",
    price: 0,
    platform: "メルカリ",
    stock: 1,
    shipping: "",
    shippingSize: "",
    tags: ["出品情報確認", "テスト"],
    description: "",
    memo: "商品マスターだけ先にある状態のテスト用",
    photos: [],
    platformItemId: unlinkedPlatformItemId,
    platformItemKey: buildPlatformItemKeyFromProduct("メルカリ", unlinkedPlatformItemId),
    itemUrl: "",
    externalData: {
      メルカリ: {
        platform: "メルカリ",
        platformItemId: unlinkedPlatformItemId,
      },
    },
    createdAt: now,
    updatedAt: now,
  };

  const unlinkedListing = {
    lid: `summary:manual-${crypto.randomUUID()}`,
    pid: "",
    platform: "メルカリ",
    platformListingId: unlinkedPlatformItemId,
    platformUrl: `https://jp.mercari.com/item/${unlinkedPlatformItemId}`,
    imageUrl: "",
    brand: "サンプルブランド",
    category: "ファッション > レディース > トップス > シャツ・ブラウス",
    description: "メルカリ側には詳細があるが、商品マスターにはまだ結び付いていない状態の確認用データです。",
    condition: "目立った傷や汚れなし",
    price: 2199,
    importedAt: now,
    importSource: "listing-summary",
    linkState: "unlinked",
    listingStatus: "出品中",
    shipping: "ゆうパケットポスト",
    shippingSize: "",
    tags: ["出品情報確認", "テスト"],
    updatedAt: now,
  };

  for (const product of samples) {
    await upsertProduct(product);
  }
  await database.runTransaction(["products", "listings", "inventories"], "readwrite", (stores) => {
    stores.products.put(buildProductMasterRecord(unlinkedProduct));
    stores.listings.put(unlinkedListing);
    stores.inventories.put(buildInventoryFromProduct(unlinkedProduct));
  });
  await inventoryRepository.saveMany(looseInventories);
  await loadProducts();
  setStatus("サンプルデータを追加しました。出品情報の確認待ちデータと未登録の在庫も追加しています。");
}

function getSelectedProduct() {
  return state.products.find((product) => product.id === state.selectedId) || null;
}

function buildProductMasterRecord(source = {}) {
  const record = {
    id: source.id,
    sku: String(source.sku || "").trim(),
    title: String(source.title || "").trim(),
    photos: Array.isArray(source.photos) ? [...source.photos] : [],
    tags: Array.isArray(source.tags) ? [...source.tags] : [],
    inventoryManagementId: String(source.inventoryManagementId || "").trim(),
    externalData: isPlainObject(source.externalData) ? { ...source.externalData } : {},
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
  };

  if (!record.id) {
    throw new Error("商品マスターのIDがありません");
  }
  return record;
}

function buildProductViewModel(product) {
  const listing = getCanonicalListingForProductId(product.id);
  const inventory = getPrimaryInventory(product.id);
  const photos = Array.isArray(product.photos) && product.photos.length > 0
    ? [...product.photos]
    : (listing?.imageUrl ? [listing.imageUrl] : []);

  return {
    ...product,
    brand: listing ? String(listing.brand || "") : String(product.brand || ""),
    category: listing ? String(listing.category || "") : String(product.category || ""),
    condition: listing ? String(listing.condition || "") : String(product.condition || ""),
    price: listing ? Number(listing.price || 0) : Number(product.price || 0),
    platform: listing ? String(listing.platform || "") : String(product.platform || ""),
    shipping: listing ? String(listing.shipping || "") : String(product.shipping || ""),
    shippingSize: listing ? String(listing.shippingSize || "") : String(product.shippingSize || ""),
    description: listing ? String(listing.description || "") : String(product.description || ""),
    platformItemId: listing ? String(listing.platformListingId || "") : String(product.platformItemId || ""),
    platformItemKey: listing
      ? buildPlatformItemKeyFromProduct(listing.platform, listing.platformListingId)
      : String(product.platformItemKey || ""),
    itemUrl: listing ? String(listing.platformUrl || "") : String(product.itemUrl || ""),
    listingStatus: listing ? String(listing.listingStatus || "") : String(product.listingStatus || ""),
    storage: inventory ? String(inventory.shelfCode || "") : String(product.storage || ""),
    stock: inventory ? Number(inventory.stock || 0) : Number(product.stock || 0),
    memo: inventory ? String(inventory.linkMemo || "") : String(product.memo || ""),
    photos,
    updatedAt: getLatestTimestamp(product.updatedAt, listing?.updatedAt, inventory?.updatedAt),
  };
}

function getCanonicalListingForProductId(productId) {
  const candidates = state.listings.filter((listing) => listing?.pid === productId);
  if (candidates.length === 0) return null;

  const primary = candidates.find((listing) => listing.lid === buildPrimaryListingId(productId));
  if (primary && hasListingDetailData(primary)) return primary;

  return [...candidates]
    .sort((a, b) => {
      const detailDifference = Number(hasListingDetailData(b)) - Number(hasListingDetailData(a));
      if (detailDifference !== 0) return detailDifference;
      return new Date(b.updatedAt || b.importedAt || 0).getTime() - new Date(a.updatedAt || a.importedAt || 0).getTime();
    })[0];
}

function getLatestTimestamp(...values) {
  const valid = values.filter((value) => value && !Number.isNaN(new Date(value).getTime()));
  if (valid.length === 0) return "";
  return valid.reduce((latest, current) => (
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  ));
}

function matchesKeyword(product, keyword) {
  if (!keyword) return true;
  const inventory = getPrimaryInventory(product.id);
  return [product.sku, product.title, product.brand, product.category, inventory?.shelfCode || product.storage, inventory?.linkMemo || product.memo]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(keyword));
}

function getFilteredLooseInventories() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  return getLooseInventories().filter((inventory) => matchesLooseInventoryKeyword(inventory, keyword));
}

function matchesLooseInventoryKeyword(inventory, keyword) {
  if (!keyword) return true;
  return [
    inventory.title,
    inventory.platform,
    inventory.platformItemId,
    inventory.platformUrl,
    inventory.shelfCode,
    inventory.linkMemo,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword));
}

function findImportedListingForLooseInventory(inventory) {
  const loosePlatform = normalizePlatform(inventory.platform);
  const loosePlatformItemId = String(inventory.platformItemId || "").trim();
  const loosePlatformItemKey = loosePlatformItemId
    ? buildPlatformItemKeyFromProduct(loosePlatform, loosePlatformItemId)
    : "";
  const looseUrl = String(inventory.platformUrl || "").trim();

  return (
    state.listings.find((listing) => {
      if (!isImportedListing(listing) || String(listing?.pid || "").trim()) return false;
      const listingKey = buildPlatformItemKeyFromProduct(listing.platform, listing.platformListingId);
      if (loosePlatformItemKey && listingKey === loosePlatformItemKey) return true;
      if (looseUrl && String(listing.platformUrl || "").trim() === looseUrl) return true;
      return false;
    }) || null
  );
}

function findExistingProductForLooseInventory(inventory) {
  const loosePlatform = normalizePlatform(inventory.platform);
  const loosePlatformItemId = String(inventory.platformItemId || "").trim();
  const loosePlatformItemKey = loosePlatformItemId
    ? buildPlatformItemKeyFromProduct(loosePlatform, loosePlatformItemId)
    : "";
  const looseUrl = String(inventory.platformUrl || "").trim();

  return (
    state.products.find((product) => {
      if (loosePlatformItemKey && getProductPlatformItemKeys(product).has(loosePlatformItemKey)) return true;
      const knownUrls = new Set([
        String(product.itemUrl || "").trim(),
        ...Object.values(product.externalData || {}).map((entry) => String(entry?.itemUrl || "").trim()),
      ].filter(Boolean));
      if (looseUrl && knownUrls.has(looseUrl)) return true;
      return false;
    }) || null
  );
}

function buildProductFromLooseInventory(inventory, matchedListing = null, now = new Date().toISOString()) {
  const platform = normalizePlatform(inventory.platform || matchedListing?.platform);
  const platformItemId = String(inventory.platformItemId || matchedListing?.platformListingId || "").trim();
  const fetchedDetail = inventory.fetchedDetail || null;
  const fetchedCondition = resolveFetchedCondition(fetchedDetail || {});
  const fetchedImages = Array.isArray(fetchedDetail?.imageUrls) ? fetchedDetail.imageUrls.filter(Boolean) : [];
  const productTitle = sanitizeDisplayTitle(inventory.title || fetchedDetail?.title) || "商品情報未入力";
  const itemUrl = String(inventory.platformUrl || matchedListing?.platformUrl || "").trim();
  const imageUrl = String(matchedListing?.imageUrl || fetchedDetail?.imageUrl || "").trim();

  return {
    id: crypto.randomUUID(),
    sku: buildSkuForLooseInventory(inventory),
    title: productTitle,
    brand: matchedListing?.brand || fetchedDetail?.brand || "",
    category: matchedListing?.category || fetchedDetail?.category || "",
    condition: matchedListing?.condition || fetchedCondition || "",
    storage: inventory.shelfCode || "",
    price: Number(matchedListing?.price || fetchedDetail?.price || 0),
    platform,
    stock: Number(inventory.stock || 0),
    shipping: matchedListing?.shipping || fetchedDetail?.shipping || "",
    shippingSize: matchedListing?.shippingSize || fetchedDetail?.shippingSize || "",
    tags: Array.isArray(matchedListing?.tags) ? [...matchedListing.tags] : [],
    description: matchedListing?.description || fetchedDetail?.description || "",
    memo: inventory.linkMemo || "",
    photos: fetchedImages.length > 0 ? fetchedImages : (imageUrl ? [imageUrl] : []),
    platformItemId,
    platformItemKey: buildPlatformItemKeyFromProduct(platform, platformItemId),
    itemUrl,
    listingStatus: matchedListing?.listingStatus || "",
    latestImportId: matchedListing?.importSource === "listing-summary" ? matchedListing.lid : "",
    latestImportAt: matchedListing?.importedAt || "",
    createdAt: now,
    updatedAt: now,
  };
}

function buildMergedProductFromLooseInventory(existingProduct, inventory, matchedListing = null, now = new Date().toISOString()) {
  const fetchedDetail = inventory.fetchedDetail || null;
  const fetchedCondition = resolveFetchedCondition(fetchedDetail || {});
  const platform = normalizePlatform(existingProduct.platform || inventory.platform || matchedListing?.platform);
  const platformItemId = String(
    existingProduct.platformItemId || inventory.platformItemId || matchedListing?.platformListingId || "",
  ).trim();
  const itemUrl = String(existingProduct.itemUrl || inventory.platformUrl || matchedListing?.platformUrl || "").trim();
  const imageUrl = String(matchedListing?.imageUrl || fetchedDetail?.imageUrl || existingProduct.photos?.[0] || "").trim();
  const fetchedImages = Array.isArray(fetchedDetail?.imageUrls) ? fetchedDetail.imageUrls.filter(Boolean) : [];

  return {
    ...existingProduct,
    sku: existingProduct.sku || buildSkuForLooseInventory(inventory),
    title: sanitizeDisplayTitle(existingProduct.title) || sanitizeDisplayTitle(inventory.title || fetchedDetail?.title) || existingProduct.sku || "商品",
    brand: existingProduct.brand || matchedListing?.brand || fetchedDetail?.brand || "",
    category: existingProduct.category || matchedListing?.category || fetchedDetail?.category || "",
    condition: existingProduct.condition || matchedListing?.condition || fetchedCondition || "",
    storage: inventory.shelfCode || existingProduct.storage || "",
    price: Number(existingProduct.price || matchedListing?.price || fetchedDetail?.price || 0),
    platform,
    stock: Number(inventory.stock || existingProduct.stock || 0),
    shipping: existingProduct.shipping || matchedListing?.shipping || fetchedDetail?.shipping || "",
    shippingSize: existingProduct.shippingSize || matchedListing?.shippingSize || fetchedDetail?.shippingSize || "",
    tags: Array.isArray(existingProduct.tags) ? [...existingProduct.tags] : [],
    description: existingProduct.description || matchedListing?.description || fetchedDetail?.description || "",
    memo: mergeLooseInventoryMemo(existingProduct.memo, inventory.linkMemo),
    photos:
      fetchedImages.length > 0
        ? [...new Set([...fetchedImages, ...(existingProduct.photos || [])].filter(Boolean))]
        : (imageUrl ? [imageUrl, ...((existingProduct.photos || []).filter((src) => src && src !== imageUrl))] : [...(existingProduct.photos || [])]),
    platformItemId,
    platformItemKey: buildPlatformItemKeyFromProduct(platform, platformItemId),
    itemUrl,
    listingStatus: existingProduct.listingStatus || matchedListing?.listingStatus || "",
    latestImportId:
      existingProduct.latestImportId || (matchedListing?.importSource === "listing-summary" ? matchedListing.lid : ""),
    latestImportAt: existingProduct.latestImportAt || matchedListing?.importedAt || "",
    updatedAt: now,
  };
}

function buildListingForPromotedProduct(product, matchedListing = null, now = new Date().toISOString()) {
  if (!matchedListing) {
    return buildListingFromProduct(product);
  }

  return {
    lid: buildPrimaryListingId(product.id),
    pid: product.id,
    platform: product.platform || matchedListing.platform || "",
    platformListingId: product.platformItemId || matchedListing.platformListingId || "",
    platformUrl: product.itemUrl || matchedListing.platformUrl || "",
    imageUrl: product.photos?.[0] || matchedListing.imageUrl || "",
    brand: product.brand || matchedListing.brand || "",
    category: product.category || matchedListing.category || "",
    description: product.description || matchedListing.description || "",
    condition: product.condition || matchedListing.condition || "",
    price: Number(product.price || matchedListing.price || 0),
    importedAt: matchedListing.importedAt || now,
    importSource: matchedListing.importSource || "manual",
    linkState: "confirmed",
    listingStatus: product.listingStatus || matchedListing.listingStatus || "",
    shipping: product.shipping || matchedListing.shipping || "",
    shippingSize: product.shippingSize || matchedListing.shippingSize || "",
    tags: Array.isArray(matchedListing.tags) ? [...matchedListing.tags] : [],
    updatedAt: now,
  };
}

function buildInventoryFromLooseInventory(product, looseInventory, now = new Date().toISOString()) {
  return {
    iid: buildPrimaryInventoryId(product.id),
    pid: product.id,
    shelfCode: looseInventory.shelfCode || product.storage || "",
    linkMemo: mergeLooseInventoryMemo(product.memo, looseInventory.linkMemo),
    checkedAt: looseInventory.checkedAt || now,
    inputDevice: looseInventory.inputDevice || "smartphone",
    stock: Number(looseInventory.stock || product.stock || 0),
    updatedAt: now,
  };
}

function buildSkuForLooseInventory(inventory) {
  const platformItemId = String(inventory.platformItemId || "").trim();
  if (platformItemId) return platformItemId;

  const seed = (inventory.title || inventory.shelfCode || crypto.randomUUID()).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `TMP-${day}-${seed || "ITEM"}-${suffix}`;
}

function mergeLooseInventoryMemo(baseMemo, inventoryMemo) {
  const parts = [String(baseMemo || "").trim(), String(inventoryMemo || "").trim()].filter(Boolean);
  return [...new Set(parts)].join("\n");
}

function splitTags(rawValue) {
  return rawValue
    ?.toString()
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean) || [];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handlePhotoInputChange() {
  const files = Array.from(elements.photos.files || []);
  if (files.length === 0) {
    return;
  }

  const newImages = await Promise.all(files.map(readFileAsDataUrl));
  state.modalImages = [...state.modalImages, ...newImages];
  elements.photos.value = "";
  renderModalPhotoPreview(state.modalImages, elements.title.value.trim() || "商品");
}

function renderModalPhotoPreview(images, title = "商品") {
  elements.modalPhotoPreview.innerHTML = "";

  if (!images || images.length === 0) {
    const empty = document.createElement("div");
    empty.className = "modal-photo-empty";
    empty.textContent = "画像を選択するとここに一覧表示されます";
    elements.modalPhotoPreview.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  images.forEach((src, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "modal-photo-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "modal-photo-button";
    button.setAttribute("aria-label", `画像 ${index + 1} を拡大`);

    const image = document.createElement("img");
    image.src = src;
    image.alt = `${title} ${index + 1}`;
    button.append(image);
    button.addEventListener("click", () => {
      openImagePreviewFromSource(src, `${title} ${index + 1}`);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "modal-photo-remove";
    removeButton.setAttribute("aria-label", `画像 ${index + 1} を削除`);
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", () => {
      state.modalImages = state.modalImages.filter((_, itemIndex) => itemIndex !== index);
      renderModalPhotoPreview(state.modalImages, elements.title.value.trim() || title);
    });

    wrapper.append(button, removeButton);
    fragment.append(wrapper);
  });

  elements.modalPhotoPreview.append(fragment);
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeImportedProduct(product) {
  const normalizedPlatform = normalizePlatform(product.platform);
  return {
    id: product.id || crypto.randomUUID(),
    sku: product.sku || "",
    title: product.title || "",
    brand: product.brand || "",
    category: product.category || "",
    condition: product.condition || "目立った傷や汚れなし",
    storage: product.storage || "",
      price: Number(product.price || 0),
      platform: normalizedPlatform,
      stock: Number(product.stock || 0),
      shipping: normalizeShippingMethod(product.shipping),
      shippingSize: normalizeShippingSize(product.shipping, product.shippingSize),
    tags: Array.isArray(product.tags) ? product.tags : splitTags(product.tags || ""),
    description: product.description || "",
    memo: product.memo || "",
    photos: Array.isArray(product.photos) ? product.photos : [],
    inventoryManagementId: product.inventoryManagementId || "",
    platformItemId: product.platformItemId || "",
    platformItemKey: product.platformItemKey || "",
    itemUrl: product.itemUrl || "",
    editUrl: product.editUrl || "",
    listingStatus: product.listingStatus || "",
    latestImportId: product.latestImportId || "",
    latestImportAt: product.latestImportAt || "",
    externalData: product.externalData || {},
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function normalizeBackupPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new Error("バックアップJSONのルートがオブジェクトではありません");
  }

  const modernStores = isPlainObject(payload.stores) ? payload.stores : null;
  const isLegacyRoot = !modernStores && Array.isArray(payload.products);
  const migrationNotes = [];
  let sourceStores;

  if (modernStores) {
    if (payload.format !== BACKUP_FORMAT) {
      throw new Error(`対応していないバックアップ形式です: ${payload.format || "未設定"}`);
    }

    const schemaVersion = Number(payload.schemaVersion);
    if (schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error(`対応していないバックアップschemaVersionです: ${payload.schemaVersion ?? "未設定"}`);
    }

    const missingStores = BACKUP_STORE_NAMES.filter((storeName) => !Array.isArray(modernStores[storeName]));
    if (missingStores.length > 0) {
      throw new Error(`バックアップに必要なストアがありません: ${missingStores.join(", ")}`);
    }

    sourceStores = Object.fromEntries(BACKUP_STORE_NAMES.map((storeName) => [storeName, modernStores[storeName]]));
  } else if (isLegacyRoot) {
    sourceStores = {
      products: payload.products,
      listings: Array.isArray(payload.listings) ? payload.listings : [],
      inventories: Array.isArray(payload.inventories) ? payload.inventories : [],
      rawImports: Array.isArray(payload.rawImports) ? payload.rawImports : [],
      listingSummaries: Array.isArray(payload.listingSummaries) ? payload.listingSummaries : [],
      platformListingLinks: Array.isArray(payload.platformListingLinks) ? payload.platformListingLinks : [],
    };
    migrationNotes.push("旧形式バックアップをschemaVersion 2へ変換して読み込みます。");
  } else {
    throw new Error("バックアップJSONに必要な stores または旧形式 products が見つかりません");
  }

  assertStoreRecords(sourceStores.products, "products", "id");
  const products = sourceStores.products.map((product) => normalizeImportedProduct(product));
  const stores = {
    ...sourceStores,
    products,
  };

  if (isLegacyRoot && stores.listings.length === 0 && products.length > 0) {
    stores.listings = products.map((product) => buildListingFromProduct(product));
    migrationNotes.push("旧形式の商品情報から出品データを補完します。");
  }
  if (isLegacyRoot && stores.inventories.length === 0 && products.length > 0) {
    stores.inventories = products.map((product) => buildInventoryFromProduct(product));
    migrationNotes.push("旧形式の商品情報から在庫データを補完します。");
  }

  stores.products = products.map((product) => buildProductMasterRecord(product));

  validateBackupStores(stores, modernStores ? payload.meta?.counts : null);

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: String(payload.exportedAt || ""),
    meta: isPlainObject(payload.meta) ? { ...payload.meta } : {},
    migrationNotes,
    stores,
  };
}

function validateBackupStores(stores, declaredCounts = null) {
  assertStoreRecords(stores.products, "products", "id");
  assertStoreRecords(stores.listings, "listings", "lid");
  assertStoreRecords(stores.inventories, "inventories", "iid");
  assertStoreRecords(stores.rawImports, "rawImports", "importId");
  assertStoreRecords(stores.listingSummaries, "listingSummaries", "summaryId");
  assertStoreRecords(stores.platformListingLinks, "platformListingLinks", "linkId");

  const productIds = new Set(stores.products.map((product) => String(product.id)));
  stores.listings.forEach((listing) => {
    const pid = String(listing.pid || "").trim();
    if (pid && !productIds.has(pid)) {
      throw new Error(`出品データ ${listing.lid} のPID参照先がありません: ${pid}`);
    }
  });
  stores.inventories.forEach((inventory) => {
    const pid = String(inventory.pid || "").trim();
    if (pid && !productIds.has(pid)) {
      throw new Error(`在庫データ ${inventory.iid} のPID参照先がありません: ${pid}`);
    }
  });

  const summaryIds = new Set(stores.listingSummaries.map((summary) => String(summary.summaryId)));
  const platformItemKeys = new Set();
  stores.platformListingLinks.forEach((link) => {
    const summaryId = String(link.summaryId || "").trim();
    if (summaryId && !summaryIds.has(summaryId)) {
      throw new Error(`出品リンク ${link.linkId} のsummaryId参照先がありません: ${summaryId}`);
    }
    const platformItemKey = String(link.platformItemKey || "").trim();
    if (!platformItemKey) {
      throw new Error(`出品リンク ${link.linkId} にplatformItemKeyがありません`);
    }
    if (platformItemKeys.has(platformItemKey)) {
      throw new Error(`出品リンクのplatformItemKeyが重複しています: ${platformItemKey}`);
    }
    platformItemKeys.add(platformItemKey);
  });

  if (isPlainObject(declaredCounts)) {
    BACKUP_STORE_NAMES.forEach((storeName) => {
      if (!(storeName in declaredCounts)) return;
      const declared = Number(declaredCounts[storeName]);
      if (!Number.isInteger(declared) || declared < 0 || declared !== stores[storeName].length) {
        throw new Error(`meta.counts.${storeName} と実データ件数が一致しません`);
      }
    });
  }
}

function assertStoreRecords(records, storeName, keyName) {
  if (!Array.isArray(records)) {
    throw new Error(`${storeName} が配列ではありません`);
  }

  const keys = new Set();
  records.forEach((record, index) => {
    if (!isPlainObject(record)) {
      throw new Error(`${storeName} の ${index + 1} 件目がオブジェクトではありません`);
    }
    const key = String(record[keyName] || "").trim();
    if (!key) {
      throw new Error(`${storeName} の ${index + 1} 件目に ${keyName} がありません`);
    }
    if (keys.has(key)) {
      throw new Error(`${storeName} の ${keyName} が重複しています: ${key}`);
    }
    keys.add(key);
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeBackupCounts(payload) {
  return {
    products: payload?.stores?.products?.length || 0,
    listings: payload?.stores?.listings?.length || 0,
    inventories: payload?.stores?.inventories?.length || 0,
    rawImports: payload?.stores?.rawImports?.length || 0,
    listingSummaries: payload?.stores?.listingSummaries?.length || 0,
    platformListingLinks: payload?.stores?.platformListingLinks?.length || 0,
  };
}

async function confirmBeforeBackupImport(backupPayload, sourceName = "") {
  const localSummary = summarizeCurrentLocalState();
  const incomingCounts = summarizeBackupCounts(backupPayload);
  const localTotal = localSummary.products + localSummary.listings + localSummary.inventories;

  if (localTotal === 0) {
    return true;
  }

  const incomingExportedAt = backupPayload?.exportedAt || "";
  const incomingLabel = sourceName || "選択したバックアップ";
  const warnings = Array.isArray(backupPayload?.migrationNotes) ? [...backupPayload.migrationNotes] : [];

  if (incomingExportedAt && localSummary.latestUpdatedAt) {
    const incomingTime = new Date(incomingExportedAt).getTime();
    const localTime = new Date(localSummary.latestUpdatedAt).getTime();
    if (Number.isFinite(incomingTime) && Number.isFinite(localTime)) {
      if (incomingTime < localTime) {
        warnings.push("Drive/バックアップ側の方が、今のローカルデータより古い可能性があります。");
      } else if (incomingTime > localTime) {
        warnings.push("Drive/バックアップ側の方が、今のローカルデータより新しい可能性があります。");
      }
    }
  }

  if (
    incomingCounts.products !== localSummary.products ||
    incomingCounts.listings !== localSummary.listings ||
    incomingCounts.inventories !== localSummary.inventories
  ) {
    warnings.push("商品・詳細・在庫の件数に差があります。");
  }

  const lines = [
    `この読み込みを続けると、現在のローカルデータを上書きします。`,
    "",
    `読み込み元: ${incomingLabel}`,
    `バックアップ日時: ${formatDateTime(incomingExportedAt)}`,
    `現在端末の最終更新: ${formatDateTime(localSummary.latestUpdatedAt)}`,
    "",
    `現在端末: 商品 ${localSummary.products} / 詳細 ${localSummary.listings} / 在庫 ${localSummary.inventories}`,
    `読み込みデータ: 商品 ${incomingCounts.products} / 詳細 ${incomingCounts.listings} / 在庫 ${incomingCounts.inventories}`,
  ];

  if (warnings.length > 0) {
    lines.push("", "注意:", ...warnings);
  }

  lines.push("", "問題なければ「この内容で読み込む」を押してください。");
  return await showBackupImportConfirmModal({
    title: "読み込み前の確認",
    body: "現在のローカルデータを上書きする前に、件数と更新日時を確認してください。",
    meta: lines.join("\n"),
    acceptLabel: "この内容で読み込む",
  });
}

async function confirmBeforeDriveOverwrite(metadata, fileId, identity = {}) {
  const remoteModifiedAt = String(metadata?.modifiedTime || "");
  const knownFileId = String(state.syncHistory.lastKnownDriveFileId || "");
  const isKnownFile = Boolean(knownFileId && knownFileId === String(fileId || ""));
  const knownModifiedAt = isKnownFile ? String(state.syncHistory.lastKnownDriveModifiedAt || "") : "";
  const fileName = String(metadata?.name || "Driveファイル");
  const mimeType = String(metadata?.mimeType || "");
  const warnings = [];
  const remoteMayHaveChanged = Boolean(knownModifiedAt && remoteModifiedAt && knownModifiedAt !== remoteModifiedAt);

  if (!isKnownFile) {
    warnings.push("この端末での読み込み・保存履歴がありません。");
  }

  if (identity.source === "backup-content") {
    warnings.push("旧形式のバックアップです。保存後に現行形式へ更新されます。");
  }

  if (mimeType && mimeType !== "application/json") {
    warnings.push(`ファイル形式: ${mimeType}`);
  }

  if (!fileName.toLowerCase().endsWith(".json")) {
    warnings.push("ファイル名が .json で終わっていません。");
  }

  if (!remoteMayHaveChanged && warnings.length === 0) {
    return true;
  }

  const fileDetails = [
    "対象ファイルのデータ",
    `ファイル名: ${fileName}`,
    `Drive更新日時: ${formatDateTime(remoteModifiedAt)}`,
    `この端末で最後に確認した日時: ${formatDateTime(knownModifiedAt)}`,
  ];
  if (warnings.length > 0) {
    fileDetails.push("", "補足", ...warnings.map((warning) => `・${warning}`));
  }

  return await showBackupImportConfirmModal({
    title: "Drive保存の確認",
    body: "Drive上のデータが更新されている可能性があります。保存しますか？",
    meta: fileDetails.join("\n"),
    acceptLabel: "この内容で保存する",
  });
}

function summarizeCurrentLocalState() {
  return {
    products: state.products.length,
    listings: state.listings.length,
    inventories: state.inventories.length,
    latestUpdatedAt: getLatestLocalActivityAt(),
  };
}

function getLatestLocalActivityAt() {
  const values = [
    ...state.products.map((product) => product.updatedAt || product.createdAt || ""),
    ...state.listings.map((listing) => listing.updatedAt || listing.importedAt || ""),
    ...state.inventories.map((inventory) => inventory.updatedAt || inventory.checkedAt || ""),
  ].filter(Boolean);

  if (values.length === 0) return "";

  return values.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  }, "");
}

function showBackupImportConfirmModal({ title, body, meta, acceptLabel = "この内容で読み込む" }) {
  if (!elements.backupImportConfirmModal) {
    return Promise.resolve(true);
  }

  elements.backupImportConfirmTitle.textContent = title;
  elements.backupImportConfirmBody.textContent = body;
  elements.backupImportConfirmMeta.textContent = meta;
  if (elements.acceptBackupImportConfirmButton) {
    elements.acceptBackupImportConfirmButton.textContent = acceptLabel;
  }

  return new Promise((resolve) => {
    state.backupImportConfirmResolver = resolve;
    if (!elements.backupImportConfirmModal.open) {
      elements.backupImportConfirmModal.showModal();
    }
  });
}

function resolveBackupImportConfirm(accepted) {
  if (typeof state.backupImportConfirmResolver === "function") {
    const resolver = state.backupImportConfirmResolver;
    state.backupImportConfirmResolver = null;
    if (elements.backupImportConfirmModal?.open) {
      elements.backupImportConfirmModal.close();
    }
    resolver(Boolean(accepted));
    return;
  }

  if (elements.backupImportConfirmModal?.open) {
    elements.backupImportConfirmModal.close();
  }
}

function loadSyncPreferences() {
  const syncSettings = readJsonStorage(SYNC_SETTINGS_STORAGE_KEY, {});
  const syncHistory = readJsonStorage(SYNC_HISTORY_STORAGE_KEY, {});
  state.syncSettings.driveClientId = String(syncSettings.driveClientId || "").trim();
  state.syncSettings.driveFileId = String(syncSettings.driveFileId || "").trim();
  state.syncSettings.driveFolderId = String(syncSettings.driveFolderId || "").trim();
  state.syncSettings.deviceName = String(syncSettings.deviceName || "").trim() || getDefaultDeviceName();
  state.syncSettings.note = String(syncSettings.note || "");
  state.syncHistory = {
    ...state.syncHistory,
    ...syncHistory,
  };

  if (elements.driveClientId) elements.driveClientId.value = state.syncSettings.driveClientId;
  if (elements.driveFileId) elements.driveFileId.value = state.syncSettings.driveFileId;
  if (elements.driveFolderId) elements.driveFolderId.value = state.syncSettings.driveFolderId;
  if (elements.syncDeviceName) elements.syncDeviceName.value = state.syncSettings.deviceName;
  if (elements.syncNote) elements.syncNote.value = state.syncSettings.note;
}

function handleSyncSettingsInput() {
  state.syncSettings.driveClientId = String(elements.driveClientId?.value || "").trim();
  state.syncSettings.driveFileId = String(elements.driveFileId?.value || "").trim();
  state.syncSettings.driveFolderId = String(elements.driveFolderId?.value || "").trim();
  state.syncSettings.deviceName = String(elements.syncDeviceName?.value || "").trim();
  state.syncSettings.note = String(elements.syncNote?.value || "");
  writeJsonStorage(SYNC_SETTINGS_STORAGE_KEY, state.syncSettings);
  renderDriveSyncInfo();
}

function buildBackupMeta(mode) {
  const deviceName = state.syncSettings.deviceName || getDefaultDeviceName();
  return {
    deviceName,
    savedBy: mode,
    syncMode: mode === "drive-api-save" ? "drive-api-sync" : mode === "manual-drive-save" ? "loose-sync" : "local-backup",
    note: String(state.syncSettings.note || "").trim(),
  };
}

function buildBackupFileName(mode, exportedAt) {
  const timestamp = formatCompactTimestamp(exportedAt);
  return mode === "manual-drive-save"
    ? `listing-assist-drive-sync-${timestamp}.json`
    : `listing-assist-backup-${timestamp}.json`;
}

function updateSyncHistoryAfterExport({ exportedAt, fileName, mode, driveFileId = "", driveModifiedAt = "" }) {
  state.syncHistory.lastExportAt = exportedAt;
  state.syncHistory.lastExportFileName = fileName;
  state.syncHistory.lastExportMode = mode;
  if (driveFileId) {
    state.syncHistory.lastKnownDriveFileId = driveFileId;
  }
  if (driveModifiedAt) {
    state.syncHistory.lastKnownDriveModifiedAt = driveModifiedAt;
  }
  writeJsonStorage(SYNC_HISTORY_STORAGE_KEY, state.syncHistory);
  renderDriveSyncInfo();
}

function updateSyncHistoryAfterImport(payload, counts, fileName = "") {
  state.syncHistory.lastImportAt = new Date().toISOString();
  state.syncHistory.lastImportedDeviceName = getImportedSourceLabel(payload, fileName);
  state.syncHistory.lastImportedExportedAt = String(payload?.exportedAt || "");
  state.syncHistory.lastImportedCounts = counts;
  state.syncHistory.lastImportedFileName = fileName;
  writeJsonStorage(SYNC_HISTORY_STORAGE_KEY, state.syncHistory);
  renderDriveSyncInfo();
}

function renderDriveSyncInfo() {
  if (!elements.driveSyncInfo) {
    renderMobileDriveSyncInfo();
    return;
  }

  const deviceName = state.syncSettings.deviceName || getDefaultDeviceName();
  const exportLabel = state.syncHistory.lastExportAt
    ? `${formatDateTime(state.syncHistory.lastExportAt)} / ${describeSyncMode(state.syncHistory.lastExportMode)} / ${state.syncHistory.lastExportFileName || "ファイル名不明"}`
    : "まだ保存していません";
  const importLabel = state.syncHistory.lastImportAt
    ? `${formatDateTime(state.syncHistory.lastImportAt)} / 保存元 ${state.syncHistory.lastImportedDeviceName || "不明"}${state.syncHistory.lastImportedFileName ? ` / ${state.syncHistory.lastImportedFileName}` : ""}`
    : "まだ読み込んでいません";
  const settingsReady = Boolean(state.syncSettings.driveClientId && extractDriveFileId(state.syncSettings.driveFileId));
  const countLabel = state.syncHistory.lastImportedCounts
    ? `直近の読み込み件数: 商品 ${state.syncHistory.lastImportedCounts.products || 0} / 詳細 ${state.syncHistory.lastImportedCounts.listings || 0} / 在庫 ${state.syncHistory.lastImportedCounts.inventories || 0}`
    : "直近の読み込み件数: なし";

  elements.driveSyncInfo.textContent = [
    `同期設定: ${settingsReady ? "設定済み" : "未設定"}`,
    `OAuthクライアントID: ${state.syncSettings.driveClientId ? "設定済み" : "未設定"}`,
    `DriveファイルID: ${extractDriveFileId(state.syncSettings.driveFileId) || "未設定"}`,
    `保存先フォルダID: ${extractDriveFolderId(state.syncSettings.driveFolderId) || "未設定"}`,
    `端末名: ${deviceName}`,
    `最終読み込み: ${importLabel}`,
    `最終保存: ${exportLabel}`,
    countLabel,
  ].join("\n");
  renderMobileDriveSyncInfo();
}

function showDriveSyncGuide() {
  renderDriveSyncInfo();
  setStatus("Drive同期の流れ: 1) 初回だけOAuthクライアントIDを設定 → 2) Driveへ保存する → 3) Driveから読み込んで最新バックアップを復元する");
}

function describeSyncMode(mode) {
  if (mode === "drive-api-save") return "Drive API保存";
  if (mode === "manual-drive-save") return "Drive共有用";
  if (mode === "manual-local-export") return "ローカル保存";
  return "不明";
}

function getImportedSourceLabel(payload, fileName = "") {
  const deviceName = String(payload?.meta?.deviceName || "").trim();
  if (deviceName) return deviceName;
  if (fileName && fileName.includes(DRIVE_DISCOVERY_SOURCE_LABEL)) return DRIVE_DISCOVERY_SOURCE_LABEL;
  const savedBy = String(payload?.meta?.savedBy || "").trim();
  if (savedBy === "drive-api-save") return DRIVE_DISCOVERY_SOURCE_LABEL;
  if (savedBy === "manual-drive-save") return "Drive共有ファイル";
  if (fileName) return fileName;
  return "旧形式または保存元未設定";
}

function extractDriveFileId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : raw;
}

function extractDriveFolderId(value) {
  return extractDriveFileId(value);
}

function isValidDriveResourceId(value) {
  return /^[-\w]{25,}$/.test(String(value || "").trim());
}

function getDefaultDeviceName() {
  const userAgent = String(globalThis.navigator?.userAgent || "").toLowerCase();
  return /iphone|android|mobile/.test(userAgent) ? "smartphone-browser" : "pc-browser";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCompactTimestamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return String(Date.now());
  }

  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ];
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function readJsonStorage(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("[Listing Assist] Failed to read local storage", error);
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("[Listing Assist] Failed to write local storage", error);
  }
}

async function backfillDerivedStoresFromProducts() {
  const [products, listings, inventories] = await Promise.all([
    productRepository.getAll(),
    listingRepository.getAll(),
    inventoryRepository.getAll(),
  ]);

  const missingListings = [];
  const missingInventories = [];

  for (const product of products) {
    const hasListing = listings.some((listing) => listing.pid === product.id);
    if (!hasListing && hasLegacyListingFields(product)) {
      missingListings.push(buildListingFromProduct(product));
    }

    const hasInventory = inventories.some((inventory) => inventory.pid === product.id);
    if (!hasInventory && hasLegacyInventoryFields(product)) {
      missingInventories.push(buildInventoryFromProduct(product));
    }
  }

  await database.runTransaction(["products", "listings", "inventories"], "readwrite", (stores) => {
    products.forEach((product) => stores.products.put(buildProductMasterRecord(product)));
    missingListings.forEach((listing) => stores.listings.put(listing));
    missingInventories.forEach((inventory) => stores.inventories.put(inventory));
  });
}

function hasLegacyListingFields(product) {
  return [
    product.platform,
    product.platformItemId,
    product.itemUrl,
    product.brand,
    product.category,
    product.condition,
    product.description,
    product.shipping,
    product.shippingSize,
  ].some((value) => String(value || "").trim() !== "") || Number(product.price || 0) !== 0;
}

function hasLegacyInventoryFields(product) {
  return [product.storage, product.memo].some((value) => String(value || "").trim() !== "") ||
    Object.prototype.hasOwnProperty.call(product, "stock");
}

function buildListingFromProduct(product) {
  const existing = state.listings.find((listing) => listing.lid === buildPrimaryListingId(product.id)) || null;
  return {
    ...(existing || {}),
    lid: buildPrimaryListingId(product.id),
    pid: product.id,
    platform: product.platform || "",
    platformListingId: product.platformItemId || "",
    platformUrl: product.itemUrl || "",
    imageUrl: product.photos?.[0] || "",
    brand: product.brand || "",
    category: product.category || "",
    description: product.description || "",
    condition: product.condition || "",
    price: Number(product.price || 0),
    importedAt: existing?.importedAt || product.latestImportAt || product.createdAt || new Date().toISOString(),
    importSource: existing?.importSource || (product.latestImportId ? "csv" : "manual"),
    linkState: "confirmed",
    listingStatus: product.listingStatus || "",
    shipping: product.shipping || "",
    shippingSize: product.shippingSize || "",
    tags: Array.isArray(product.tags) ? [...product.tags] : [],
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function buildInventoryFromProduct(product) {
  const existing = getPrimaryInventory(product.id);
  return {
    ...(existing || {}),
    iid: buildPrimaryInventoryId(product.id),
    pid: product.id,
    shelfCode: product.storage || "",
    linkMemo: product.memo || "",
    checkedAt: product.updatedAt || existing?.checkedAt || product.createdAt || new Date().toISOString(),
    inputDevice: existing?.inputDevice || "pc",
    stock: Number(product.stock || 0),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function buildPrimaryListingId(productId) {
  return `product:${productId}:primary`;
}

function buildPrimaryInventoryId(productId) {
  return `product:${productId}:primary`;
}

function getCsvValue(product, key) {
  if (key === "tags") return product.tags.join("|");
  return product[key] ?? "";
}

function buildMercariPayload(product, options = {}) {
  const includePhotos = options.includePhotos !== false;
  const assistSource = buildAssistSource(product);
  return {
    type: "listing-assist-mercari",
    version: 1,
    exportedAt: new Date().toISOString(),
    productId: product.id,
    product: {
      sku: assistSource.sku,
      title: buildMercariTitle(assistSource),
      description: buildMercariDescription(assistSource),
      brand: assistSource.brand,
      category: assistSource.category,
      condition: assistSource.condition,
      price: Number(assistSource.price || 0),
      shipping: assistSource.shipping,
      shippingSize: normalizeShippingSize(assistSource.shipping, assistSource.shippingSize),
      tags: assistSource.tags,
      memo: assistSource.memo,
      photos: includePhotos ? assistSource.photos : [],
    },
  };
}

function buildMercariTitle(product) {
  return [product.brand, product.title]
    .filter(Boolean)
    .join(" ")
    .slice(0, 40);
}

function buildMercariDescription(product) {
  return [
    product.description || "",
    product.tags?.length ? `#${product.tags.join(" #")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildYahooAuctionPayload(product, options = {}) {
  const includePhotos = options.includePhotos !== false;
  const assistSource = buildAssistSource(product);
  return {
    type: "listing-assist-yahoo-auction",
    version: 1,
    exportedAt: new Date().toISOString(),
    productId: product.id,
    product: {
      sku: assistSource.sku,
      title: buildYahooAuctionTitle(assistSource),
      description: buildYahooAuctionDescription(assistSource),
      brand: assistSource.brand,
      category: assistSource.category,
      condition: assistSource.condition,
      price: Number(assistSource.price || 0),
      platform: assistSource.platform,
      shipping: assistSource.shipping,
      shippingSize: normalizeShippingSize(assistSource.shipping, assistSource.shippingSize),
      stock: Number(assistSource.stock || 0),
      memo: assistSource.memo,
      tags: assistSource.tags,
      photos: includePhotos ? assistSource.photos : [],
    },
  };
}

function buildYahooAuctionTitle(product) {
  return [product.brand, product.title]
    .filter(Boolean)
    .join(" ")
    .slice(0, 65);
}

function buildYahooAuctionDescription(product) {
  return [
    product.description || "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAssistSource(product) {
  const listing = getLinkedListingForProduct(product) || getImportedListingForProduct(product) || null;
  const inventory = getPrimaryInventory(product.id);
  const externalEntry = Object.values(product.externalData || {}).find((entry) => entry?.imageUrl || entry?.description || entry?.price) || {};
  const externalImageUrl = externalEntry.imageUrl || "";
  const listingImageUrl = String(listing?.imageUrl || "").trim();
  const imageCandidates = [
    ...(Array.isArray(product.photos) ? product.photos : []),
    listingImageUrl,
    externalImageUrl,
  ].filter((src, index, list) => String(src || "").trim() !== "" && list.indexOf(src) === index);

  return {
    sku: product.sku || "",
    title: sanitizeDisplayTitle(product.title) || "",
    brand: listing?.brand || product.brand || externalEntry.brand || "",
    category: listing?.category || product.category || externalEntry.category || "",
    condition: listing?.condition || product.condition || externalEntry.condition || "",
    price: Number(listing?.price ?? product.price ?? externalEntry.price ?? 0),
    platform: listing?.platform || product.platform || externalEntry.platform || "",
    shipping: listing?.shipping || product.shipping || externalEntry.shipping || "",
    shippingSize: listing?.shippingSize || product.shippingSize || externalEntry.shippingSize || "",
    stock: Number(inventory?.stock ?? product.stock ?? 0),
    memo: inventory?.linkMemo || product.memo || "",
    tags: Array.isArray(product.tags) ? product.tags : [],
    description: listing?.description || product.description || externalEntry.description || "",
    photos: imageCandidates,
  };
}

function escapeCsv(value) {
  const stringValue = String(value).replace(/"/g, "\"\"");
  return `"${stringValue}"`;
}

function sortByUpdatedAtDesc(a, b) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function formatYen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatInputDeviceLabel(value) {
  switch (String(value || "").trim()) {
    case "smartphone":
      return "スマホ";
    case "qr":
      return "QR";
    case "manual":
      return "手動";
    case "pc":
    default:
      return "PC";
  }
}

function getPreviewImage(product) {
  if (product.photos?.[0]) return product.photos[0];

  const externalImageUrl = Object.values(product.externalData || {}).find((entry) => entry?.imageUrl)?.imageUrl || "";
  return externalImageUrl || createImagePlaceholder();
}

function createImagePlaceholder() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="10" fill="#eadcc9"/>
      <path d="M14 32l7-8 5 5 4-4 4 7H14z" fill="#b69776"/>
      <circle cx="19" cy="18" r="3" fill="#c9ad8f"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function setStatus(message, isError = false) {
  if (state.desktopStatusTimer) {
    clearTimeout(state.desktopStatusTimer);
    state.desktopStatusTimer = 0;
  }
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("is-error", Boolean(isError));
  if (message) {
    state.desktopStatusTimer = window.setTimeout(() => {
      if (elements.statusMessage.textContent === message) {
        elements.statusMessage.textContent = "";
        elements.statusMessage.classList.remove("is-error");
      }
      state.desktopStatusTimer = 0;
    }, isError ? 8000 : 4500);
  }
  if (elements.mobileStatusMessage) {
    if (state.mobileStatusTimer) {
      clearTimeout(state.mobileStatusTimer);
      state.mobileStatusTimer = 0;
    }
    elements.mobileStatusMessage.textContent = message;
    elements.mobileStatusMessage.classList.toggle("is-error", Boolean(isError));
    if (message) {
      state.mobileStatusTimer = window.setTimeout(() => {
        if (elements.mobileStatusMessage.textContent === message) {
          elements.mobileStatusMessage.textContent = "";
          elements.mobileStatusMessage.classList.remove("is-error");
        }
        state.mobileStatusTimer = 0;
      }, isError ? 8000 : 4500);
    }
  }
}

function showCsvImportModal(options) {
  showOperationStatusModal({
    eyebrow: "CSV読み込み",
    ...options,
  });
}

function showDriveOperationModal(options) {
  showOperationStatusModal({
    eyebrow: "Google Drive",
    ...options,
  });
}

function showOperationStatusModal({ eyebrow = "処理結果", title, body, meta = "", tone = "progress" }) {
  if (!elements.csvImportModal) return;

  if (elements.csvImportEyebrow) {
    elements.csvImportEyebrow.textContent = eyebrow;
  }
  elements.csvImportTitle.textContent = title;
  elements.csvImportBody.textContent = body;
  elements.csvImportMeta.textContent = meta;
  elements.csvImportMeta.parentElement.dataset.tone = tone;
  if (elements.closeCsvImportModalButton) {
    elements.closeCsvImportModalButton.disabled = tone === "progress";
  }

  if (!elements.csvImportModal.open) {
    elements.csvImportModal.showModal();
  }
}

function normalizePlatform(value) {
  if (!value) return "";
  const normalized = String(value).trim();
  if (normalized.includes("メルカリ")) return "メルカリ";
  if (normalized.includes("ヤフオク")) return "ヤフオク";
  return normalized;
}

function normalizeShippingMethod(value) {
  const normalized = String(value || "").trim();
  return MERCARI_ANONYMOUS_SHIPPING_METHODS.includes(normalized) ? normalized : "";
}

function normalizeShippingSize(shipping, value) {
  if (normalizeShippingMethod(shipping) !== "宅急便") return "";
  const normalized = String(value || "").trim();
  return MERCARI_TAKKYUBIN_SIZES.includes(normalized) ? normalized : "";
}

function resolveFetchedCondition(detail = {}) {
  const explicit = normalizeInternalCondition(String(detail.condition || "").trim());
  if (explicit) return explicit;

  const sourceText = [
    detail.description,
    detail.title,
    detail.category,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n");

  if (!sourceText) return "";
  if (/未使用[・･]未開封/.test(sourceText)) return "新品、未使用";
  if (/新品[・､、 ]*未使用/.test(sourceText)) return "新品、未使用";
  if (/未使用に近い/.test(sourceText)) return "未使用に近い";
  if (/目立った傷や汚れなし/.test(sourceText)) return "目立った傷や汚れなし";
  if (/やや傷や汚れあり/.test(sourceText)) return "やや傷や汚れあり";
  if (/傷や汚れあり/.test(sourceText)) return "傷や汚れあり";
  if (/全体的に状態が悪い/.test(sourceText)) return "全体的に状態が悪い";
  if (/未使用/.test(sourceText)) return "新品、未使用";
  if (/中古/.test(sourceText)) return "中古";
  return "";
}

function mergeFetchedDetailIntoExternalData(existingExternalData = {}, detail = null, overrides = {}) {
  const platform = normalizePlatform(overrides.platform || detail?.platform || "");
  if (!platform) return existingExternalData || {};

  const platformKey = platform || "unknown";
  const current = existingExternalData?.[platformKey] || {};
  const imageUrls = Array.isArray(detail?.imageUrls)
    ? detail.imageUrls.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const imageUrl = String(detail?.imageUrl || imageUrls[0] || "").trim();

  return {
    ...(existingExternalData || {}),
    [platformKey]: {
      ...current,
      platform,
      platformItemId: overrides.platformItemId || detail?.platformItemId || current.platformItemId || "",
      itemUrl: overrides.itemUrl || detail?.platformUrl || current.itemUrl || "",
      imageUrl: imageUrl || current.imageUrl || "",
      imageUrls: imageUrls.length > 0 ? imageUrls : (Array.isArray(current.imageUrls) ? current.imageUrls : []),
      title: String(detail?.title || current.title || "").trim(),
      description: String(detail?.description || current.description || "").trim(),
      condition: normalizeInternalCondition(detail?.condition || current.condition || ""),
      price: Number(detail?.price || current.price || 0),
      category: String(detail?.category || current.category || "").trim(),
      brand: String(detail?.brand || current.brand || "").trim(),
      shipping: String(detail?.shipping || current.shipping || "").trim(),
      shippingSize: String(detail?.shippingSize || current.shippingSize || "").trim(),
      fetchedAt: new Date().toISOString(),
    },
  };
}

function normalizeInternalCondition(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized === "未使用") return "新品、未使用";
  if (normalized === "未使用・未開封") return "新品、未使用";
  return normalized;
}

function detectPlatformFromListingUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";
  const parsed = parseUrlSafely(normalized);
  const hostname = parsed?.hostname || "";
  if (isMercariHost(hostname) || (!parsed && /\/(?:item|items)\//i.test(normalized))) {
    return "メルカリ";
  }
  if (isYahooAuctionHost(hostname) || (!parsed && (/\/auction\//i.test(normalized) || /[?&]aID=/i.test(normalized)))) {
    return "ヤフオク";
  }
  return "";
}

function extractPlatformItemIdFromListingUrl(platform, url) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";

  if (platform === "ヤフオク") {
    return normalized.match(/(?:aID=|\/auction\/)([a-z]\d+)/i)?.[1] || "";
  }

  if (platform === "メルカリ") {
    return normalized.match(/(?:\/item\/|\/items\/)(m[0-9a-z]+)/i)?.[1] || "";
  }

  return "";
}

function buildPlatformItemKeyFromProduct(platform, platformItemId) {
  if (!String(platformItemId || "").trim()) return "";
  return `${platform || "unknown"}:${platformItemId || ""}`;
}

function parseUrlSafely(value) {
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
}

function isAllowedListingHost(hostname) {
  return isMercariHost(hostname) || isYahooAuctionHost(hostname);
}

function isMercariHost(hostname) {
  return hostname === "jp.mercari.com" || hostname === "mercari.com" || hostname === "www.mercari.com" || hostname === "static.mercdn.net";
}

function isYahooAuctionHost(hostname) {
  return hostname === "auctions.yahoo.co.jp";
}

function handleShippingChange() {
  syncShippingSizeField(elements.shipping.value);
}

function syncShippingSizeField(shipping) {
  const showSize = normalizeShippingMethod(shipping) === "宅急便";
  elements.shippingSizeGroup.classList.toggle("is-hidden", !showSize);
  elements.shippingSize.disabled = !showSize;
  if (!showSize) {
    elements.shippingSize.value = "";
  }
}

function renderPlatformCell(cell, product, linkStatus = null, reviewFlags = []) {
  cell.textContent = "";
  const displayListing = linkStatus?.listing || null;
  const displaySource = displayListing
    ? {
        ...product,
        platform: displayListing.platform || product.platform,
        shipping: displayListing.shipping || product.shipping,
        shippingSize: displayListing.shippingSize || product.shippingSize,
      }
    : product;

  const platformLine = document.createElement("div");
  platformLine.className = "platform-name";
  platformLine.textContent = displaySource.platform || "-";
  cell.append(platformLine);

  const shippingLabel = formatShippingLabel(displaySource);
  if (shippingLabel) {
    const shippingLine = document.createElement("div");
    shippingLine.className = "shipping-note";
    shippingLine.textContent = shippingLabel;
    cell.append(shippingLine);
  }

  if (linkStatus?.label && linkStatus.mode !== "linked") {
    const badge = document.createElement("span");
    badge.className = `link-badge is-${linkStatus.mode}`;
    badge.textContent = linkStatus.label;
    cell.append(badge);
  }

  const extraFlags = reviewFlags.filter((flag) => !["detail_missing", "needs_link"].includes(flag.key));
  if (extraFlags.length === 0) return;

  const flagList = document.createElement("div");
  flagList.className = "review-flag-list";
  extraFlags.forEach((flag) => {
    const chip = document.createElement("span");
    chip.className = `review-flag is-${flag.tone}`;
    chip.textContent = flag.label;
    flagList.append(chip);
  });
  cell.append(flagList);
}

function formatShippingLabel(product) {
  const shipping = normalizeShippingMethod(product.shipping);
  if (!shipping) return "";
  const shippingSize = normalizeShippingSize(product.shipping, product.shippingSize);
  if (shipping === "宅急便" && shippingSize) {
    return `${shipping} ${shippingSize}サイズ`;
  }
  return shipping;
}

function formatListingShippingSummary(product) {
  const parts = [];
  const platform = normalizePlatform(product.platform);
  const shipping = formatShippingLabel(product);
  if (platform) parts.push(platform);
  if (shipping) parts.push(shipping);
  return parts.length > 0 ? parts.join(" / ") : "-";
}

function sanitizeDisplayTitle(title) {
  const normalized = String(title || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const cutoffPatterns = [
    /\s*[¥￥]\s?\d[\d,]*/,
    /\s*\d[\d,]*円/,
    /\s*半年以上前に出品/,
    /\s*再出品/,
    /\s*削除/,
    /\s*コメ(?:\(\d+\))?/,
    /\s*コメ削/,
    /\s*編集/,
    /\s*停止/,
  ];

  let cutoffIndex = normalized.length;
  for (const pattern of cutoffPatterns) {
    const match = normalized.match(pattern);
    if (match && typeof match.index === "number") {
      cutoffIndex = Math.min(cutoffIndex, match.index);
    }
  }

  return normalized.slice(0, cutoffIndex).trim();
}

function encodePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
