# KRC721 Portfolio Overview

This document summarizes how the application builds the “KRC721 NFTs” portion of a user’s portfolio from the `user-holdings-v2` backend endpoint. The focus is on data contracts, filtering, pagination, and derived values—without any framework-specific implementation details.

## Request Flow

1. **Authenticated call** to `GET https://dev-api.kaspa.com/krc721/user-holdings-v2`.
   - Optional `ticker` query parameter narrows the result set server-side.
   - Failures are caught and surfaced as an empty list so the portfolio view always has predictable data.
2. The response is cached briefly client-side (5 minutes) to avoid refetching while a session remains active.

## Data Contracts

### Holdings payload

```ts
interface UserHoldingsResponse {
  ticker: string;
  tokenIds: string[];
}

interface UserHoldingsResponseV2 {
  ticker: string;
  tokenIds: string[] | Krc721Token[];
}

interface Krc721Token {
  _id: string;
  ticker: string;
  tokenId: number;
  traits?: Record<string, { value: string; rarity: number }>;
  rarityRank?: number;
}
```

- `user-holdings-v2` may return plain token ID strings or full `Krc721Token` objects. Consumers must normalize both shapes (e.g., `typeof tokenId === 'string' ? tokenId : tokenId.tokenId.toString()`).
- Trait metadata, when present, allows richer displays (rarity, filters) without issuing extra metadata requests.

### Portfolio view models

```ts
interface NftPortfolioFilters {
  offset: number;
  limit: number;
  tickers?: string[];
}

interface NftPortfolioItem {
  ticker: string;
  tokenId: string;
}

interface NftPortfolioResponse {
  result: NftPortfolioItem[];
  next?: number;
}
```

- `tickers` is maintained entirely on the client; it drives in-memory filtering before pagination.
- `next` contains the start index for the next slice (or `undefined` when the end of the flattened list is reached).

## Filtering Logic

1. Fetch the full holdings array for the active wallet.
2. If the user selects one or more tickers, filter the array down to matching entries. When no tickers are selected, all holdings remain.
3. Flatten the array so each `{ticker, tokenId}` pair becomes an independent portfolio item. This is necessary because the backend groups token IDs under each ticker to minimize payload size.

This approach keeps server requests simple (no compound filters) and shifts UX-specific filtering to the client, which already has all holdings in memory.

## Pagination Logic

Pagination is entirely client-driven:

1. Determine the `limit` from `NftPortfolioFilters`. The default uses `getRequestLimit(24)`, which doubles the base page size when `window.innerHeight >= 1800` to better fill large displays.
2. For each load:
   - `start` = current cursor (an absolute index into the flattened array).
   - `end` = `start + limit`.
   - Slice `flattened[start:end]` to produce `result`.
   - Set `next = end < flattened.length ? end : undefined`.
3. When the UI needs more rows, it passes the previous `next` value as the new cursor.

Because the pagination cursor is simply an array index, the client never needs to coordinate state with the backend for “next page” tokens.

## Scroll-Triggered Loading

The portfolio list listens to scroll events on its container. When the user reaches 80% of the scrollable height, it triggers another pagination fetch (as described above). This keeps the experience infinite-scroll friendly without duplicating pagination logic.

## Holdings Worth Calculation

To display total asset worth per ticker:

1. Reuse the holdings payload from `user-holdings-v2`.
2. For each ticker, request its floor price via `GET /krc721/data/floor-price`.
3. Multiply `floorPrice * tokenCount` to estimate holdings value in KAS.
4. Sum all tickers to display the total balance indicator. Because price data can change frequently, this calculation runs in parallel with the main holdings fetch but uses the same cache window (5 minutes) to avoid excessive API calls.

## Rarity Rank Colors

### Classification logic

Ranks are mapped to rarity tiers using only two inputs: the token’s rank inside its collection (`rarityRank`) and the collection’s total supply (`totalSupply`). The thresholds are percentage-based:

| Tier        | Condition                                   | Meaning                 |
|-------------|---------------------------------------------|-------------------------|
| Legendary   | `rarityRank < 0`                            | Explicit override       |
| Gold        | `rarityRank <= totalSupply * 0.01`          | Top 1% of the supply    |
| Silver      | `rarityRank <= totalSupply * 0.1`           | Top 10% of the supply   |
| Bronze      | `rarityRank <= totalSupply * 0.3`           | Top 30% of the supply   |
| Neutral     | anything else                               | Remaining 70% of items  |

“Legendary” skips the percentage math so special drops (or eggs) can force a unique badge by returning `-1` from the backend. All other tiers fall back to their respective gradients. When either `rarityRank` or `totalSupply` is missing, the badge defaults to Neutral to avoid misleading information.

The tag label is `Legendary` for the override case; otherwise it renders `Rank: #<rarityRank>`.

### Color system

Once a tier is picked, the badge receives a matching class. Each class applies a gradient background, text color, and subtle shadow so tiers are instantly recognizable:

```css
.rank-tag.neutral   { background: linear-gradient(180deg, #222829, #1a1f20); color: #fff; box-shadow: 0 0 8px rgba(34,40,41,0.6); }
.rank-tag.legendary { background: linear-gradient(180deg, #ba68c8, #6f2da8); color: #fff; box-shadow: 0 0 8px rgba(186,104,200,0.6); }
.rank-tag.gold      { background: linear-gradient(180deg, #fcee1f, #d9b70b); color: #111000; box-shadow: 0 0 8px rgba(252,238,31,0.6); }
.rank-tag.silver    { background: linear-gradient(180deg, #ffffff, #cdcdcd); color: #000; }
.rank-tag.bronze    { background: linear-gradient(180deg, #d07129, #75471b); color: #fff; }
```

The `.rank-tag` selector describes whatever DOM element the UI uses for the badge (typically a pill-shaped tag). The key idea is that the class name mirrors the rarity enum, so UI code only needs to translate the data tier into the corresponding class; the styling follows automatically.

## Summary

- **Single source of truth**: `user-holdings-v2` supplies ownership data, reducing the number of backend calls.
- **Client-side filtering/pagination**: keeps the UX responsive and lets users slice data instantly.
- **Flexible data model**: supports both basic token IDs and enriched metadata payloads.
- **Derived insights**: floor-price lookups transform raw holdings into meaningful value summaries without blocking the primary portfolio load.

