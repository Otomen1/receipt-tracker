import { Category } from "./types";

const MERCHANT_RULES: [RegExp, Category][] = [
  [/lotus|tesco|aeon|mydin|econsave|nsk|village grocer|jaya grocer|99\s*speed|giant|caring|mercato|hero|cold storage|ben's independent/i, "Groceries"],
  [/mcdonald|kfc|pizza|burger king|nando|subway|starbucks|tealive|chatime|marrybrown|secret recipe|old town|sushi|sakae|kenny rogers|papa john|domino|restoran|kopitiam|mamak|warung|kedai makan/i, "Restaurant"],
  [/petronas|shell|caltex|bhpetrol|petron|setel|grab|myrapid|rapid kl|lrt|mrt|ktm|komuter|bas|teksi|apad|highway|lebuhraya|parking|e-parking/i, "Transport"],
  [/familymart|7.eleven|7-eleven|mynews|shopee|lazada|zalora|h&m|uniqlo|padini|mr diy|ace hardware|ikea|watson|guardian|caring pharmacy|alpro|boots/i, "Shopping"],
];

const KEYWORD_RULES: [RegExp, Category][] = [
  [/grocery|groceries|hypermarket|supermarket|pasar raya|minimarket/i, "Groceries"],
  [/restaurant|café|cafe|food court|hawker|makan|dine|coffee|bakery|kedai/i, "Restaurant"],
  [/petrol|diesel|fuel|minyak|parking|toll|e-hailing|ride/i, "Transport"],
  [/fashion|clothing|apparel|electronics|gadget|hardware|pharmacy|farmasi/i, "Shopping"],
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
