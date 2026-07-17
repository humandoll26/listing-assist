import { STORE_PRODUCTS } from "./constants.js";

export class ProductRepository {
  constructor(database) {
    this.database = database;
  }

  async getAll() {
    return this.database.getAll(STORE_PRODUCTS);
  }

  async save(product) {
    return this.database.put(STORE_PRODUCTS, product);
  }

  async saveMany(products) {
    return this.database.bulkPut(STORE_PRODUCTS, products);
  }

  async delete(productId) {
    return this.database.delete(STORE_PRODUCTS, productId);
  }

  async deleteMany(productIds) {
    return this.database.bulkDelete(STORE_PRODUCTS, productIds);
  }
}
