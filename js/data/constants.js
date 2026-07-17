export const DB_NAME = "listing-assist-mvp";
export const DB_VERSION = 3;

export const STORE_PRODUCTS = "products";
export const STORE_LISTINGS = "listings";
export const STORE_INVENTORIES = "inventories";
export const STORE_RAW_IMPORTS = "rawImports";
export const STORE_LISTING_SUMMARIES = "listingSummaries";
export const STORE_PLATFORM_LISTING_LINKS = "platformListingLinks";

export const MERCARI_PAYLOAD_PREFIX = "LISTING_ASSIST_MERCARI_PAYLOAD::";
export const MERCARI_SELL_URL = "https://jp.mercari.com/sell/create";
export const MERCARI_HASH_KEY = "listing-assist";

export const YAHOO_AUCTION_PAYLOAD_PREFIX = "LISTING_ASSIST_YAHOO_AUCTION::";
export const YAHOO_AUCTION_SELL_URL = "https://auctions.yahoo.co.jp/jp/show/submit?category=0";
export const YAHOO_AUCTION_HASH_KEY = "listing-assist-yahoo";

export const MERCARI_ANONYMOUS_SHIPPING_METHODS = [
  "\u30cd\u30b3\u30dd\u30b9",
  "\u5b85\u6025\u4fbf\u30b3\u30f3\u30d1\u30af\u30c8",
  "\u5b85\u6025\u4fbf",
  "\u3086\u3046\u30d1\u30b1\u30c3\u30c8",
  "\u3086\u3046\u30d1\u30b1\u30c3\u30c8\u30dd\u30b9\u30c8",
  "\u3086\u3046\u30d1\u30b1\u30c3\u30c8\u30d7\u30e9\u30b9",
  "\u3086\u3046\u30d1\u30c3\u30af",
];

export const MERCARI_TAKKYUBIN_SIZES = ["60", "80", "100", "120", "140", "160", "180", "200"];

export const LISTING_PLATFORM_KEYS = {
  mercari: "\u30e1\u30eb\u30ab\u30ea",
  yahoo: "\u30e4\u30d5\u30aa\u30af",
};
