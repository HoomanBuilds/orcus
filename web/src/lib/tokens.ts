// Token addresses on 0G Galileo testnet (Chain ID 16602)
// Verified via Zer0/Jaine factory getPool() calls — all have non-zero liquidity

export const WOGN_ADDRESS = "0x0fE9B43625fA7EdD663aDcEC0728DD635e4AbF7c";

// All tokens that have a live WA0GI/Token pool on Zer0 DEX (fee=3000)
export const SWAP_TARGETS = [
  {
    symbol: "USDT",
    address: "0xed0103a53069a347ed40290e0a069b46fd50ba05",
    label: "Tether USD",
    pool: "0xb3ec2336feceb01c289cc13d17d1c455de37dbca",
  },
  {
    symbol: "DOGE",
    address: "0x88d749370d9af8dfd3c6f32b9b4a51b52566f7d7",
    label: "Dogecoin",
    pool: "0x9a5424756c4bb71feabc1f255dcf1a858805d70e",
  },
  {
    symbol: "DEEPSEEKR1",
    address: "0x3af1c220228e643d2d9661a09e1dca64dbc095ea",
    label: "DeepSeek-R1",
    pool: "0xef48068d07084e314192b0fdddbca7309429583e",
  },
  {
    symbol: "SPLOPENDAT",
    address: "0xd6014a4b6c3aaf4da2d3db3bb8f2335eab5f3100",
    label: "SPL-Open-Data",
    pool: "0x126ada1bd7b9605c095d28393f81914e9e68076a",
  },
  {
    symbol: "SAT",
    address: "0xaca81fe7b7d655ce9e8e32fca64086ab964ae2f2",
    label: "SAT",
    pool: "0x1e01de1f3552972888c603870cbec5545c44d5cf",
  },
  {
    symbol: "ZIMAGE",
    address: "0xe9f94f17f885bc75cb0f0c9a7fb4c3f927cf99cd",
    label: "ZIMAGE",
    pool: "0xf2ee91fa9dd641513c6127684d7414160c32aa55",
  },
  {
    symbol: "L2SCAN",
    address: "0x773e1efa90f8025374083933377f61aa8fdbc4a2",
    label: "L2SCAN",
    pool: "0x5ea20c77cb8f1da20eb54588b264aca22d410cbc",
  },
  {
    symbol: "WAWA",
    address: "0x712a1d02dedd5d23113719a31f31686f03b5de1a",
    label: "WAWA",
    pool: "0x6e9fd15571cc7bd7c1f141d916d6d9dfdb639fc9",
  },
  {
    symbol: "CUA",
    address: "0xbb2778bc7ed302d046c0eee2c0c675c312cecc2f",
    label: "CUA",
    pool: "0x216d1d87c901efb352ab50c52c30d66785721015",
  },
] as const;

export type SwapTargetSymbol = (typeof SWAP_TARGETS)[number]["symbol"];

export const DEFAULT_TOKEN_OUT: SwapTargetSymbol = "USDT";
