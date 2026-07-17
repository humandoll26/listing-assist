import { ListingAssistDatabase } from "./js/data/listing-assist-database.js";
import { InventoryRepository } from "./js/data/inventory-repository.js";
import { ProductRepository } from "./js/data/product-repository.js";
import { ImportRepository } from "./js/data/import-repository.js";
import { ListingRepository } from "./js/data/listing-repository.js";
import { ListingImportService } from "./js/data/listing-import-service.js";

globalThis.ListingAssistDatabase = ListingAssistDatabase;
globalThis.InventoryRepository = InventoryRepository;
globalThis.ProductRepository = ProductRepository;
globalThis.ImportRepository = ImportRepository;
globalThis.ListingRepository = ListingRepository;
globalThis.ListingImportService = ListingImportService;

await import("./app.js");
