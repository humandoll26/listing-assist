import {
  DB_NAME,
  DB_VERSION,
  STORE_INVENTORIES,
  STORE_LISTING_SUMMARIES,
  STORE_LISTINGS,
  STORE_PLATFORM_LISTING_LINKS,
  STORE_PRODUCTS,
  STORE_RAW_IMPORTS,
} from "./constants.js";

export class ListingAssistDatabase {
  constructor({ name = DB_NAME, version = DB_VERSION } = {}) {
    this.name = name;
    this.version = version;
    this.dbPromise = null;
  }

  open() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.name, this.version);

        request.onupgradeneeded = () => {
          this.upgrade(request.result, request.transaction);
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return this.dbPromise;
  }

  upgrade(db, transaction) {
    const products = this.ensureStore(db, transaction, STORE_PRODUCTS, { keyPath: "id" });
    this.ensureIndex(products, "bySku", "sku", { unique: false });
    this.ensureIndex(products, "byInventoryManagementId", "inventoryManagementId", { unique: false });
    this.ensureIndex(products, "byPlatformItemKey", "platformItemKey", { unique: false });
    this.ensureIndex(products, "byUpdatedAt", "updatedAt", { unique: false });

    const listings = this.ensureStore(db, transaction, STORE_LISTINGS, { keyPath: "lid" });
    this.ensureIndex(listings, "byPid", "pid", { unique: false });
    this.ensureIndex(listings, "byPlatform", "platform", { unique: false });
    this.ensureIndex(listings, "byPlatformListingId", "platformListingId", { unique: false });
    this.ensureIndex(listings, "byUpdatedAt", "updatedAt", { unique: false });
    this.ensureIndex(listings, "byImportedAt", "importedAt", { unique: false });

    const inventories = this.ensureStore(db, transaction, STORE_INVENTORIES, { keyPath: "iid" });
    this.ensureIndex(inventories, "byPid", "pid", { unique: false });
    this.ensureIndex(inventories, "byShelfCode", "shelfCode", { unique: false });
    this.ensureIndex(inventories, "byCheckedAt", "checkedAt", { unique: false });
    this.ensureIndex(inventories, "byUpdatedAt", "updatedAt", { unique: false });

    const rawImports = this.ensureStore(db, transaction, STORE_RAW_IMPORTS, { keyPath: "importId" });
    this.ensureIndex(rawImports, "byPlatform", "platform", { unique: false });
    this.ensureIndex(rawImports, "byImportedAt", "importedAt", { unique: false });

    const listingSummaries = this.ensureStore(db, transaction, STORE_LISTING_SUMMARIES, { keyPath: "summaryId" });
    this.ensureIndex(listingSummaries, "byPlatform", "platform", { unique: false });
    this.ensureIndex(listingSummaries, "byPlatformItemId", "platformItemId", { unique: false });
    this.ensureIndex(listingSummaries, "byInventoryManagementId", "inventoryManagementId", { unique: false });
    this.ensureIndex(listingSummaries, "byImportedAt", "importedAt", { unique: false });
    this.ensureIndex(listingSummaries, "byImportId", "importId", { unique: false });

    const platformLinks = this.ensureStore(db, transaction, STORE_PLATFORM_LISTING_LINKS, { keyPath: "linkId" });
    this.ensureIndex(platformLinks, "byInventoryManagementId", "inventoryManagementId", { unique: false });
    this.ensureIndex(platformLinks, "byPlatformItemKey", "platformItemKey", { unique: true });
    this.ensureIndex(platformLinks, "bySummaryId", "summaryId", { unique: false });
  }

  ensureStore(db, transaction, storeName, options) {
    if (db.objectStoreNames.contains(storeName)) {
      return transaction.objectStore(storeName);
    }

    return db.createObjectStore(storeName, options);
  }

  ensureIndex(store, indexName, keyPath, options) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, options);
    }
  }

  async transaction(storeNames, mode = "readonly") {
    const db = await this.open();
    return db.transaction(storeNames, mode);
  }

  async getAll(storeName) {
    const tx = await this.transaction(storeName, "readonly");
    return promisifyRequest(tx.objectStore(storeName).getAll());
  }

  async put(storeName, value) {
    const tx = await this.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    return waitForTransaction(tx);
  }

  async bulkPut(storeName, values) {
    if (!Array.isArray(values) || values.length === 0) return;
    const tx = await this.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    values.forEach((value) => store.put(value));
    return waitForTransaction(tx);
  }

  async delete(storeName, key) {
    const tx = await this.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    return waitForTransaction(tx);
  }

  async bulkDelete(storeName, keys) {
    if (!Array.isArray(keys) || keys.length === 0) return;
    const tx = await this.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    keys.forEach((key) => store.delete(key));
    return waitForTransaction(tx);
  }

  async runTransaction(storeNames, mode, operation) {
    const names = Array.isArray(storeNames) ? [...new Set(storeNames)] : [storeNames];
    const tx = await this.transaction(names, mode);
    const stores = Object.fromEntries(names.map((storeName) => [storeName, tx.objectStore(storeName)]));

    try {
      const result = operation(stores, tx);
      if (result && typeof result.then === "function") {
        throw new Error("runTransactionのコールバックは同期的にIndexedDBリクエストを登録してください");
      }
    } catch (error) {
      tx.abort();
      throw error;
    }

    return waitForTransaction(tx);
  }

  async replaceSnapshot(stores) {
    const storeNames = [
      STORE_PRODUCTS,
      STORE_LISTINGS,
      STORE_INVENTORIES,
      STORE_RAW_IMPORTS,
      STORE_LISTING_SUMMARIES,
      STORE_PLATFORM_LISTING_LINKS,
    ];
    return this.runTransaction(storeNames, "readwrite", (transactionStores) => {
      storeNames.forEach((storeName) => {
        transactionStores[storeName].clear();
      });

      putMany(transactionStores[STORE_PRODUCTS], stores.products);
      putMany(transactionStores[STORE_LISTINGS], stores.listings);
      putMany(transactionStores[STORE_INVENTORIES], stores.inventories);
      putMany(transactionStores[STORE_RAW_IMPORTS], stores.rawImports);
      putMany(transactionStores[STORE_LISTING_SUMMARIES], stores.listingSummaries);
      putMany(transactionStores[STORE_PLATFORM_LISTING_LINKS], stores.platformListingLinks);
    });
  }

  async exportSnapshot(options = {}) {
    const [products, listings, inventories, rawImports, listingSummaries, platformListingLinks] = await Promise.all([
      this.getAll(STORE_PRODUCTS),
      this.getAll(STORE_LISTINGS),
      this.getAll(STORE_INVENTORIES),
      this.getAll(STORE_RAW_IMPORTS),
      this.getAll(STORE_LISTING_SUMMARIES),
      this.getAll(STORE_PLATFORM_LISTING_LINKS),
    ]);

    return {
      format: "listing-assist-backup",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      version: this.version,
      meta: {
        deviceName: options.deviceName || "",
        savedBy: options.savedBy || "manual-local-export",
        syncMode: options.syncMode || "local-backup",
        note: options.note || "",
        counts: {
          products: products.length,
          listings: listings.length,
          inventories: inventories.length,
          rawImports: rawImports.length,
          listingSummaries: listingSummaries.length,
          platformListingLinks: platformListingLinks.length,
        },
      },
      stores: {
        products,
        listings,
        inventories,
        rawImports,
        listingSummaries,
        platformListingLinks,
      },
    };
  }
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

function putMany(store, values) {
  if (!Array.isArray(values) || values.length === 0) return;
  values.forEach((value) => store.put(value));
}
