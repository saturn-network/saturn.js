"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const ora_1 = __importDefault(require("ora"));
const exchange_1 = require("./exchange");
const utils_1 = require("./utils");
const etherAddress = '0x0000000000000000000000000000000000000000';
class TxFailedError extends Error {
}
class RequestManager {
    constructor(url) {
        this.apiurl = url;
    }
    getTransaction(tx, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/transactions/${blockchain}/${tx}.json`;
            let response = yield axios_1.default.request({
                url: url, headers: { 'Origin': 'saturnjs' }
            }).catch(error => {
                return Promise.reject(new Error(error.response));
            });
            let transaction = response.data;
            return transaction;
        });
    }
    getOrderByTx(tx, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/orders/by_tx/${blockchain}/${tx}.json`;
            let response = yield axios_1.default.request({
                url: url, headers: { 'Origin': 'saturnjs' }
            }).catch(error => {
                return Promise.reject(new Error(error.response));
            });
            let order = response.data;
            return order;
        });
    }
    awaitOrderTx(tx, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.awaitTransaction(tx, blockchain, `Awaiting order ${tx}`);
            let order = yield this.getOrderByTx(tx, this.blockchainName(blockchain));
            return order;
        });
    }
    getTradeByTx(tx, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/trades/by_tx/${blockchain}/${tx}.json`;
            let response = yield axios_1.default.request({
                url: url, headers: { 'Origin': 'saturnjs' }
            }).catch(error => {
                return Promise.reject(new Error(error.response));
            });
            let trade = response.data;
            return trade;
        });
    }
    awaitTradeTx(tx, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.awaitTransaction(tx, blockchain, `Awaiting trade ${tx}`);
            let trade = yield this.getTradeByTx(tx, this.blockchainName(blockchain));
            return trade;
        });
    }
    getTokenInfo(address, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/tokens/show/${blockchain}/${address}.json`;
            let response = yield axios_1.default.request({
                url: url, headers: { 'Origin': 'saturnjs' }
            }).catch(error => {
                return Promise.reject(new Error(error.response));
            });
            let token = response.data;
            return token;
        });
    }
    awaitTransaction(tx, blockchain, text) {
        return __awaiter(this, void 0, void 0, function* () {
            let transaction, spinner;
            if (!text) {
                text = `Awaiting transaction ${tx}`;
            }
            if (this.isCLI()) {
                spinner = ora_1.default({
                    text: text,
                    color: this.pickColor(this.blockchainName(blockchain))
                }).start();
            }
            if (blockchain instanceof exchange_1.Web3Interface) {
                try {
                    yield blockchain.wallet.provider.waitForTransaction(tx);
                    let receipt = yield blockchain.wallet.provider.getTransactionReceipt(tx);
                    const gaslimit = '400000';
                    if (receipt.status === 0 || receipt.gasUsed.toString() === gaslimit) {
                        throw new TxFailedError(`Transaction ${tx} on ${this.blockchainName(blockchain)} failed.`);
                    }
                }
                catch (e) {
                    if (e instanceof TxFailedError) {
                        if (spinner) {
                            spinner.clear();
                            spinner.stop();
                        }
                        throw e;
                    }
                }
            }
            while (true) {
                try {
                    transaction = yield this.getTransaction(tx, this.blockchainName(blockchain));
                    if (spinner) {
                        spinner.clear();
                        spinner.stop();
                    }
                    break;
                }
                catch (e) {
                    yield utils_1.sleep(5000);
                }
            }
            return transaction;
        });
    }
    getExchangeContract(blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/orders/contracts.json`;
            let result = (yield axios_1.default.get(url)).data[blockchain.toUpperCase()];
            if (result == null) {
                return Promise.reject(new Error(`Unable to fetch contract address for blockchain ${blockchain}`));
            }
            return result;
        });
    }
    ordersForAddress(address) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/orders/trader/${address}.json`;
            let result = yield axios_1.default.get(url);
            if (result == null) {
                return Promise.reject(new Error(`Unable to fetch orders for address ${address}`));
            }
            return result.data.buy_orders.concat(result.data.sell_orders);
        });
    }
    orderbook(token, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/orders/${blockchain}/${token}/${etherAddress}/all.json`;
            let result = yield axios_1.default.get(url);
            if (result == null) {
                return Promise.reject(new Error(`Unable to fetch orderbook for token ${blockchain}:${token}`));
            }
            return result.data;
        });
    }
    ohlcv(token, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/tokens/ohlcv/${blockchain}/${token}/24h.json`;
            let result = yield axios_1.default.get(url);
            if (result == null) {
                return Promise.reject(new Error(`Unable to fetch ohlcv for token ${blockchain}:${token}`));
            }
            return result.data;
        });
    }
    tradeHistory(token, blockchain) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `${this.apiurl}/trades/${blockchain}/${token}/${etherAddress}/all.json`;
            let result = yield axios_1.default.get(url);
            if (result == null) {
                return Promise.reject(new Error(`Unable to fetch trade history for token ${blockchain}:${token}`));
            }
            return result.data;
        });
    }
    pickColor(blockchain) {
        let b = blockchain.toUpperCase();
        if (b == 'ETH') {
            return 'gray';
        }
        if (b == 'ETC') {
            return 'green';
        }
        throw new Error('Unknown blockchain');
    }
    blockchainName(obj) {
        return obj instanceof exchange_1.Web3Interface ? obj.blockchain : obj;
    }
    isCLI() {
        return !(typeof window !== 'undefined' && typeof window.document !== 'undefined');
    }
}
exports.RequestManager = RequestManager;
