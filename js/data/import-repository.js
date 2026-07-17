import {
  STORE_LISTING_SUMMARIES,
  STORE_PLATFORM_LISTING_LINKS,
  STORE_RAW_IMPORTS,
} from "./constants.js";

export class ImportRepository {
  constructor(database) {
    this.database = database;
  }

  async saveRawImport(rawImport) {
    return this.database.put(STORE_RAW_IMPORTS, rawImport);
  }

  async saveListingSummaries(listingSummaries) {
    return this.database.bulkPut(STORE_LISTING_SUMMARIES, listingSummaries);
  }

  async savePlatformListingLinks(platformListingLinks) {
    return this.database.bulkPut(STORE_PLATFORM_LISTING_LINKS, platformListingLinks);
  }
}
