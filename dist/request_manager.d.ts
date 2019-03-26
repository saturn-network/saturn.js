import { Transaction, Order, Trade, Token } from './exchange/types';
import { Web3Interface } from './exchange';
export declare class RequestManager {
    readonly apiurl: string;
    constructor(url: string);
    getTransaction(tx: string, blockchain: string): Promise<Transaction | Error>;
    getOrderByTx(tx: string, blockchain: string): Promise<Order | Error>;
    awaitOrderTx(tx: string, blockchain: string | Web3Interface): Promise<Order>;
    getTradeByTx(tx: string, blockchain: string): Promise<Trade | Error>;
    awaitTradeTx(tx: string, blockchain: string | Web3Interface): Promise<Trade>;
    getTokenInfo(address: string, blockchain: string): Promise<Token | Error>;
    awaitTransaction(tx: string, blockchain: string | Web3Interface, text?: string): Promise<Transaction>;
    getExchangeContract(blockchain: string): Promise<string | Error>;
    ordersForAddress(address: string): Promise<Array<Order>>;
    orderbook(token: string, blockchain: string): Promise<object>;
    ohlcv(token: string, blockchain: string): Promise<object>;
    tradeHistory(token: string, blockchain: string): Promise<object>;
    private pickColor;
    private blockchainName;
    private isCLI;
}
