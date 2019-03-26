export interface Transaction {
    blockchain: string;
    blocknumber: number;
    created_at: number;
    gasprice: number;
    gasused: number;
    from: string;
    to: string;
    tx: string;
    txprice: number;
    value: number;
}
export interface Trade {
    blockchain: string;
    blocknumber: number;
    buyer: string;
    seller: string;
    trade_miner_address: string;
    buytoken: TokenSummary;
    selltoken: TokenSummary;
    buytokenamount: number;
    selltokenamount: number;
    contract: string;
    order_id: number;
    order_owner: string;
    created_at: number;
    order_tx: string;
    order_type: string;
    price: number;
    trademiningamount?: number | null;
    transaction: string;
}
export interface Order {
    active: boolean;
    balance: number;
    blockchain: string;
    blocknumber: number;
    buytoken: TokenSummary;
    selltoken: TokenSummary;
    contract: string;
    created_at: number;
    order_id: number;
    owner: string;
    price: number;
    transaction: string;
    type: string;
}
export interface TokenSummary {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
}
interface LiquidityDepth {
    ether: number;
    tokens: number;
}
export interface Token {
    address: string;
    best_buy_order: number;
    best_buy_order_tx: string;
    best_buy_price: number;
    best_sell_order: number;
    best_sell_order_tx: string;
    best_sell_price: number;
    blockchain: string;
    change_pct: number;
    dashboard_price: number;
    decimals: number;
    total_supply: number;
    liquidity_depth: LiquidityDepth;
    name: string;
    symbol: string;
    price24hr: number;
    volume24hr: number;
}
export {};
