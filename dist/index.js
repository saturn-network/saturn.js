"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const request_manager_1 = require("./request_manager");
const exchange_1 = require("./exchange");
const lodash_1 = __importDefault(require("lodash"));
class Saturn {
    constructor(apiurl, wallets) {
        if (lodash_1.default.endsWith(apiurl, '/')) {
            apiurl = apiurl.slice(0, -1);
        }
        this.query = new request_manager_1.RequestManager(apiurl);
        if (wallets) {
            if (wallets.eth) {
                this.eth = this.setWallet(wallets.eth, "ETH", this.query);
            }
            if (wallets.etc) {
                this.etc = this.setWallet(wallets.etc, "ETC", this.query);
            }
        }
    }
    setWallet(wallet, blockchain, requestManager) {
        return new exchange_1.Web3Interface(wallet, blockchain, requestManager);
    }
}
exports.Saturn = Saturn;
