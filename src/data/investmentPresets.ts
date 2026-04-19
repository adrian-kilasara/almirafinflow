import type { CurrencyCode } from '@/types/finance';

export interface InvestmentPreset {
  /** Display name shown in the picker */
  label: string;
  /** Short description (sector / region / fund family) */
  hint: string;
  /** Pre-fills the `name` field */
  name: string;
  /** Pre-fills the `symbol` field (uppercase ticker) */
  symbol?: string;
  /** Maps to InvestmentTracker INVESTMENT_TYPES.value */
  type: 'stocks' | 'crypto' | 'bonds' | 'real_estate' | 'mutual_funds' | 'sacco' | 'commodities' | 'other';
  /** Pre-fills the `platform` field */
  platform?: string;
  /** Pre-fills the `currency` */
  currency: CurrencyCode;
  /** Searchable keywords (lowercase) */
  keywords: string[];
}

/**
 * Curated investment instruments common in East Africa + global majors.
 * Static metadata only — no external API. Users can still type freely.
 */
export const INVESTMENT_PRESETS: InvestmentPreset[] = [
  // ========== TANZANIA — UTT AMIS Funds ==========
  { label: 'UTT AMIS Liquid Fund', hint: 'Tanzania · Money Market', name: 'UTT AMIS Liquid Fund', type: 'mutual_funds', platform: 'UTT AMIS', currency: 'TZS', keywords: ['utt', 'amis', 'liquid', 'money market', 'tanzania'] },
  { label: 'UTT AMIS Bond Fund', hint: 'Tanzania · Government Bonds', name: 'UTT AMIS Bond Fund', type: 'bonds', platform: 'UTT AMIS', currency: 'TZS', keywords: ['utt', 'amis', 'bond', 'tanzania', 'government'] },
  { label: 'UTT AMIS Wekeza Maisha', hint: 'Tanzania · Long-term Wealth', name: 'UTT AMIS Wekeza Maisha', type: 'mutual_funds', platform: 'UTT AMIS', currency: 'TZS', keywords: ['utt', 'wekeza', 'maisha', 'tanzania'] },
  { label: 'UTT AMIS Umoja Fund', hint: 'Tanzania · Equity & Bonds', name: 'UTT AMIS Umoja Fund', type: 'mutual_funds', platform: 'UTT AMIS', currency: 'TZS', keywords: ['utt', 'umoja', 'tanzania'] },
  { label: 'UTT AMIS Watoto Fund', hint: 'Tanzania · Children\'s Plan', name: 'UTT AMIS Watoto Fund', type: 'mutual_funds', platform: 'UTT AMIS', currency: 'TZS', keywords: ['utt', 'watoto', 'children', 'tanzania'] },

  // ========== TANZANIA — DSE-listed Stocks ==========
  { label: 'CRDB Bank (DSE)', hint: 'Tanzania · Banking', name: 'CRDB Bank Plc', symbol: 'CRDB', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['crdb', 'bank', 'dse', 'tanzania'] },
  { label: 'NMB Bank (DSE)', hint: 'Tanzania · Banking', name: 'NMB Bank Plc', symbol: 'NMB', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['nmb', 'bank', 'dse', 'tanzania'] },
  { label: 'Tanzania Breweries (DSE)', hint: 'Tanzania · Consumer', name: 'Tanzania Breweries Ltd', symbol: 'TBL', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['tbl', 'breweries', 'beer', 'dse', 'tanzania'] },
  { label: 'Vodacom Tanzania (DSE)', hint: 'Tanzania · Telecom', name: 'Vodacom Tanzania', symbol: 'VODA', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['vodacom', 'voda', 'telecom', 'dse', 'tanzania'] },
  { label: 'Tanzania Portland Cement (DSE)', hint: 'Tanzania · Industrial', name: 'Tanzania Portland Cement Co.', symbol: 'TPCC', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['tpcc', 'cement', 'twiga', 'dse', 'tanzania'] },
  { label: 'NICOL (DSE)', hint: 'Tanzania · Insurance', name: 'NICOL', symbol: 'NICO', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['nicol', 'nico', 'insurance', 'dse'] },
  { label: 'TCC (DSE)', hint: 'Tanzania · Tobacco', name: 'Tanzania Cigarette Co.', symbol: 'TCC', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['tcc', 'tobacco', 'dse', 'tanzania'] },
  { label: 'Swissport Tanzania (DSE)', hint: 'Tanzania · Aviation', name: 'Swissport Tanzania Plc', symbol: 'SWIS', type: 'stocks', platform: 'DSE', currency: 'TZS', keywords: ['swissport', 'aviation', 'dse'] },

  // ========== TANZANIA — Treasury ==========
  { label: 'Tanzania Treasury Bill (91-day)', hint: 'Tanzania · Short-term Govt', name: 'Tanzania T-Bill 91d', type: 'bonds', platform: 'BOT', currency: 'TZS', keywords: ['t-bill', 'tbill', 'treasury', 'bot', 'tanzania'] },
  { label: 'Tanzania Treasury Bill (364-day)', hint: 'Tanzania · 1-Year Govt', name: 'Tanzania T-Bill 364d', type: 'bonds', platform: 'BOT', currency: 'TZS', keywords: ['t-bill', 'tbill', 'treasury', 'bot', 'tanzania'] },
  { label: 'Tanzania Treasury Bond (5y)', hint: 'Tanzania · 5-Year Govt', name: 'Tanzania Treasury Bond 5y', type: 'bonds', platform: 'BOT', currency: 'TZS', keywords: ['treasury', 'bond', '5 year', 'bot', 'tanzania'] },
  { label: 'Tanzania Treasury Bond (10y)', hint: 'Tanzania · 10-Year Govt', name: 'Tanzania Treasury Bond 10y', type: 'bonds', platform: 'BOT', currency: 'TZS', keywords: ['treasury', 'bond', '10 year', 'bot', 'tanzania'] },

  // ========== KENYA — NSE Stocks ==========
  { label: 'Safaricom (NSE)', hint: 'Kenya · Telecom', name: 'Safaricom Plc', symbol: 'SCOM', type: 'stocks', platform: 'NSE', currency: 'KES', keywords: ['safaricom', 'scom', 'mpesa', 'nse', 'kenya'] },
  { label: 'Equity Group (NSE)', hint: 'Kenya · Banking', name: 'Equity Group Holdings', symbol: 'EQTY', type: 'stocks', platform: 'NSE', currency: 'KES', keywords: ['equity', 'eqty', 'bank', 'nse', 'kenya'] },
  { label: 'KCB Group (NSE)', hint: 'Kenya · Banking', name: 'KCB Group Plc', symbol: 'KCB', type: 'stocks', platform: 'NSE', currency: 'KES', keywords: ['kcb', 'bank', 'nse', 'kenya'] },
  { label: 'EABL (NSE)', hint: 'Kenya · Consumer', name: 'East African Breweries Ltd', symbol: 'EABL', type: 'stocks', platform: 'NSE', currency: 'KES', keywords: ['eabl', 'breweries', 'tusker', 'nse', 'kenya'] },
  { label: 'Co-operative Bank (NSE)', hint: 'Kenya · Banking', name: 'Co-operative Bank of Kenya', symbol: 'COOP', type: 'stocks', platform: 'NSE', currency: 'KES', keywords: ['coop', 'cooperative', 'bank', 'nse'] },

  // ========== KENYA — Money Market Funds ==========
  { label: 'CIC Money Market Fund', hint: 'Kenya · Money Market', name: 'CIC Money Market Fund', type: 'mutual_funds', platform: 'CIC Asset Mgmt', currency: 'KES', keywords: ['cic', 'mmf', 'money market', 'kenya'] },
  { label: 'Britam Money Market Fund', hint: 'Kenya · Money Market', name: 'Britam Money Market Fund', type: 'mutual_funds', platform: 'Britam', currency: 'KES', keywords: ['britam', 'mmf', 'money market', 'kenya'] },
  { label: 'Sanlam Money Market Fund', hint: 'Kenya · Money Market', name: 'Sanlam Money Market Fund', type: 'mutual_funds', platform: 'Sanlam', currency: 'KES', keywords: ['sanlam', 'mmf', 'money market', 'kenya'] },

  // ========== CRYPTO ==========
  { label: 'Bitcoin (BTC)', hint: 'Crypto · Largest', name: 'Bitcoin', symbol: 'BTC', type: 'crypto', platform: 'Binance', currency: 'USD', keywords: ['btc', 'bitcoin', 'crypto'] },
  { label: 'Ethereum (ETH)', hint: 'Crypto · Smart Contracts', name: 'Ethereum', symbol: 'ETH', type: 'crypto', platform: 'Binance', currency: 'USD', keywords: ['eth', 'ethereum', 'crypto'] },
  { label: 'Tether (USDT)', hint: 'Crypto · Stablecoin', name: 'Tether USD', symbol: 'USDT', type: 'crypto', platform: 'Binance', currency: 'USD', keywords: ['usdt', 'tether', 'stablecoin', 'crypto'] },
  { label: 'BNB', hint: 'Crypto · Binance', name: 'Binance Coin', symbol: 'BNB', type: 'crypto', platform: 'Binance', currency: 'USD', keywords: ['bnb', 'binance', 'crypto'] },
  { label: 'Solana (SOL)', hint: 'Crypto · Layer-1', name: 'Solana', symbol: 'SOL', type: 'crypto', platform: 'Binance', currency: 'USD', keywords: ['sol', 'solana', 'crypto'] },

  // ========== FOREX (common pairs) ==========
  { label: 'EUR/USD', hint: 'Forex · Major Pair', name: 'EUR/USD', symbol: 'EURUSD', type: 'other', platform: 'Forex Broker', currency: 'USD', keywords: ['eur', 'usd', 'forex', 'eurusd'] },
  { label: 'GBP/USD', hint: 'Forex · Major Pair', name: 'GBP/USD', symbol: 'GBPUSD', type: 'other', platform: 'Forex Broker', currency: 'USD', keywords: ['gbp', 'usd', 'forex', 'gbpusd', 'pound'] },
  { label: 'USD/JPY', hint: 'Forex · Major Pair', name: 'USD/JPY', symbol: 'USDJPY', type: 'other', platform: 'Forex Broker', currency: 'USD', keywords: ['usd', 'jpy', 'forex', 'yen'] },
  { label: 'USD/TZS', hint: 'Forex · Tanzania', name: 'USD/TZS', symbol: 'USDTZS', type: 'other', platform: 'Forex Broker', currency: 'TZS', keywords: ['usd', 'tzs', 'forex', 'shilling'] },
  { label: 'USD/KES', hint: 'Forex · Kenya', name: 'USD/KES', symbol: 'USDKES', type: 'other', platform: 'Forex Broker', currency: 'KES', keywords: ['usd', 'kes', 'forex', 'shilling'] },

  // ========== GLOBAL STOCKS ==========
  { label: 'Apple Inc.', hint: 'USA · Tech', name: 'Apple Inc.', symbol: 'AAPL', type: 'stocks', platform: 'NASDAQ', currency: 'USD', keywords: ['apple', 'aapl', 'tech', 'nasdaq'] },
  { label: 'Microsoft', hint: 'USA · Tech', name: 'Microsoft Corp.', symbol: 'MSFT', type: 'stocks', platform: 'NASDAQ', currency: 'USD', keywords: ['microsoft', 'msft', 'tech', 'nasdaq'] },
  { label: 'NVIDIA', hint: 'USA · Tech', name: 'NVIDIA Corp.', symbol: 'NVDA', type: 'stocks', platform: 'NASDAQ', currency: 'USD', keywords: ['nvidia', 'nvda', 'tech', 'gpu', 'ai'] },
  { label: 'S&P 500 ETF (VOO)', hint: 'USA · Index Fund', name: 'Vanguard S&P 500 ETF', symbol: 'VOO', type: 'mutual_funds', platform: 'NYSE', currency: 'USD', keywords: ['voo', 's&p', 'sp500', 'index', 'vanguard', 'etf'] },
];

/**
 * Filter presets by a free-text query (matches label, name, symbol, or keywords).
 */
export function searchPresets(query: string, limit = 20): InvestmentPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return INVESTMENT_PRESETS.slice(0, limit);
  return INVESTMENT_PRESETS.filter(p =>
    p.label.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    (p.symbol || '').toLowerCase().includes(q) ||
    p.keywords.some(k => k.includes(q))
  ).slice(0, limit);
}
