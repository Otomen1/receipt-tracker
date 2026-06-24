import { Category } from "./types";

const MERCHANT_RULES: [RegExp, Category][] = [
  [/lotus|tesco|aeon|mydin|econsave|nsk|village grocer|jaya grocer|99\s*speed|giant|mercato|hero|cold storage|ben's independent/i, "Groceries"],
  [/mcdonald|kfc|pizza|burger king|nando|subway|starbucks|tealive|chatime|marrybrown|secret recipe|old town|sushi|sakae|kenny rogers|papa john|domino|restoran|kopitiam|mamak|warung|kedai makan/i, "Restaurant"],
  [/petronas|shell|caltex|bhpetrol|petron|setel|grab|myrapid|rapid kl|lrt|mrt|ktm|komuter|bas|teksi|apad|highway|lebuhraya|parking|e-parking/i, "Transport"],
  [/familymart|7.eleven|7-eleven|mynews|shopee|lazada|zalora|h&m|uniqlo|padini|mr diy|ace hardware|ikea/i, "Shopping"],
  [/watson|guardian|caring pharmacy|alpro|boots|pharmacy|klinik|clinic|hospital|mediviron|pantai|columbia asia|kpj|poliklinik/i, "Healthcare"],
  [/tgv|gsc|mbo|lotus's cinema|cinema|wayang|karaoke|neway|red box|bowling|escape|theme park|legoland|sunway lagoon|steam|playstation|xbox|games/i, "Entertainment"],
  [/tnb|tenaga nasional|unifi|maxis|celcom|digi|u mobile|yes 4g|astro|syabas|air selangor|indah water|telekom/i, "Utilities"],
  [/hotel|airbnb|marriott|hilton|hyatt|doubletree|pacific regency|airasia|malindo|mas|malaysia airlines|firefly|grab express|lalamove/i, "Travel"],
  [/saloon|salon|spa|nail|barber|hair|waxing|beautique|beauty|lashes|brow/i, "Beauty"],
  [/tuition|sekolah|school|university|kolej|college|popular|mph|kinokuniya|bookstore|buku|stationery|stationary|coursera|udemy/i, "Education"],
];

const KEYWORD_RULES: [RegExp, Category][] = [
  [/grocery|groceries|hypermarket|supermarket|pasar raya|minimarket/i, "Groceries"],
  [/restaurant|caf[eé]|food court|hawker|makan|dine|bakery|kedai/i, "Restaurant"],
  [/petrol|diesel|fuel|minyak|parking|toll|e-hailing|ride/i, "Transport"],
  [/fashion|clothing|apparel|electronics|gadget|hardware/i, "Shopping"],
  [/medical|dental|dentist|doctor|ubat|medicine|vitamin|health|klinik|clinic|hospital|pharmacy|farmasi/i, "Healthcare"],
  [/cinema|movie|entertainment|leisure|game|recreation|sport|gym|fitness/i, "Entertainment"],
  [/electric|water|internet|broadband|mobile plan|phone bill|utility|utilities|bil|subscription/i, "Utilities"],
  [/hotel|flight|accommodation|travel|vacation|trip|resort|inn|lodge/i, "Travel"],
  [/salon|spa|nail|hair|beauty|grooming|barbershop|massage/i, "Beauty"],
  [/tuition|school|university|college|book|stationery|course|class|education/i, "Education"],
];

export function classifyReceipt(
  merchant: string | null,
  rawText: string | null,
  llmCategory: Category | null
): Category {
  const haystack = `${merchant ?? ""} ${rawText ?? ""}`;

  for (const [pattern, category] of MERCHANT_RULES) {
    if (pattern.test(haystack)) return category;
  }
  for (const [pattern, category] of KEYWORD_RULES) {
    if (pattern.test(haystack)) return category;
  }

  return llmCategory ?? "Other";
}
