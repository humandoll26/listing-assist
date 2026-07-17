import { STORE_INVENTORIES } from "./constants.js";

export class InventoryRepository {
  constructor(database) {
    this.database = database;
  }

  async getAll() {
    return this.database.getAll(STORE_INVENTORIES);
  }

  async save(inventory) {
    return this.database.put(STORE_INVENTORIES, inventory);
  }

  async saveMany(inventories) {
    return this.database.bulkPut(STORE_INVENTORIES, inventories);
  }

  async delete(inventoryId) {
    return this.database.delete(STORE_INVENTORIES, inventoryId);
  }

  async deleteMany(inventoryIds) {
    return this.database.bulkDelete(STORE_INVENTORIES, inventoryIds);
  }
}
