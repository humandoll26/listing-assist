import { STORE_LISTINGS } from "./constants.js";

export class ListingRepository {
  constructor(database) {
    this.database = database;
  }

  async getAll() {
    return this.database.getAll(STORE_LISTINGS);
  }

  async save(listing) {
    return this.database.put(STORE_LISTINGS, listing);
  }

  async saveMany(listings) {
    return this.database.bulkPut(STORE_LISTINGS, listings);
  }

  async delete(listingId) {
    return this.database.delete(STORE_LISTINGS, listingId);
  }

  async deleteMany(listingIds) {
    return this.database.bulkDelete(STORE_LISTINGS, listingIds);
  }
}
