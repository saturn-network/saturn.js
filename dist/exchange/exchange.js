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
const fraction_js_1 = __importDefault(require("fraction.js"));
const axios_1 = __importDefault(require("axios"));
const lodash_1 = __importDefault(require("lodash"));
const ethers_1 = require("ethers");
const utils_1 = require("ethers/utils");
const exchangeConfig_json_1 = __importDefault(require("./exchangeConfig.json"));
const erc223_json_1 = __importDefault(require("./erc223.json"));
const erc20_json_1 = __importDefault(require("./erc20.json"));
const etherDecimals = 18;
const gaslimit = 400000;
const etherAddress = '0x0000000000000000000000000000000000000000';
let toSuitableBigNumber = function (n) {
    if (n instanceof utils_1.BigNumber) {
        return n;
    }
    if (n instanceof fraction_js_1.default) {
        return ethers_1.utils.bigNumberify(n.valueOf().toString());
    }
    try {
        return ethers_1.utils.bigNumberify(n.valueOf());
    }
    catch (e) {
        let tmp = ethers_1.utils.bigNumberify(n.toString());
        if (tmp.toString() !== n.toString()) {
            throw e;
        }
        return tmp;
    }
};
class Web3Interface {
    constructor(wallet, blockchain, requestManager) {
        this.wallet = wallet;
        this.blockchain = blockchain;
        this.query = requestManager;
        this.exchangeAbi = exchangeConfig_json_1.default.abi;
    }
    newTrade(amount, orderTx) {
        return __awaiter(this, void 0, void 0, function* () {
            let order = yield this.query.awaitOrderTx(orderTx, this.blockchain);
            yield this.verifyCapacity(amount, order);
            yield this.verifyOrderTradable(order);
            if (order.type.toLowerCase() === "sell") {
                return (yield this.newEtherTrade(amount, order));
            }
            else if (order.type.toLowerCase() === "buy") {
                let tokenAddress = order.buytoken.address;
                let tokenType = yield this.determineTokenType(tokenAddress);
                if (tokenType === "ERC223") {
                    return (yield this.newERC223Trade(tokenAddress, amount, order));
                }
                else {
                    return (yield this.newERC20Trade(tokenAddress, amount, order));
                }
            }
            else {
                throw new Error(`Unknown order type for order_tx ${orderTx} on ${this.blockchain}`);
            }
        });
    }
    newOrder(tokenAddress, orderType, amount, price) {
        return __awaiter(this, void 0, void 0, function* () {
            this.verifyOrderType(orderType);
            let tokenType = yield this.determineTokenType(tokenAddress);
            let orderContract = yield this.query.getExchangeContract(this.blockchain);
            if (orderType === "buy") {
                yield this.verifyEtherBalance(amount * price);
                return (yield this.newBuyOrder(tokenAddress, amount, price, orderContract));
            }
            else if (orderType === "sell") {
                yield this.verifyTokenBalance(tokenAddress, amount);
                if (tokenType === "ERC223") {
                    return (yield this.newERC223sellOrder(tokenAddress, amount, price, orderContract));
                }
                else {
                    return (yield this.newERC20sellOrder(tokenAddress, amount, price, orderContract));
                }
            }
            else {
                throw new Error(`Unknown order type ${orderType}`);
            }
        });
    }
    cancelOrder(orderId, contract) {
        return __awaiter(this, void 0, void 0, function* () {
            let exchange = new ethers_1.Contract(contract, this.exchangeAbi, this.wallet);
            let gasPrice = yield this.getGasPrice();
            let tx = yield exchange.cancelOrder(orderId, { gasPrice: gasPrice, gasLimit: gaslimit });
            return tx.hash;
        });
    }
    newBuyOrder(tokenAddress, amount, price, orderContract) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = new ethers_1.Contract(tokenAddress, erc20_json_1.default, this.wallet);
            let exchange = new ethers_1.Contract(orderContract, this.exchangeAbi, this.wallet);
            let decimals = yield token.decimals();
            let parsedPrice = new fraction_js_1.default(price)
                .mul(new fraction_js_1.default(10).pow(etherDecimals))
                .div(new fraction_js_1.default(10).pow(Number(decimals.toString())));
            let parsedAmount = new fraction_js_1.default(amount * price).mul(new fraction_js_1.default(10).pow(etherDecimals));
            let gasPrice = yield this.getGasPrice();
            let tx = yield exchange.sellEther(tokenAddress, toSuitableBigNumber(parsedPrice.n), toSuitableBigNumber(parsedPrice.d), { gasPrice: gasPrice, value: toSuitableBigNumber(parsedAmount), gasLimit: gaslimit });
            return tx.hash;
        });
    }
    newERC223sellOrder(tokenAddress, amount, price, orderContract) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = new ethers_1.Contract(tokenAddress, erc223_json_1.default, this.wallet);
            let decimals = yield token.decimals();
            let parsedAmount = new fraction_js_1.default(amount)
                .mul(new fraction_js_1.default(10).pow(Number(decimals.toString())));
            let parsedPrice = new fraction_js_1.default(price)
                .mul(new fraction_js_1.default(10).pow(etherDecimals))
                .div(new fraction_js_1.default(10).pow(Number(decimals.toString())));
            parsedPrice = new fraction_js_1.default(1).div(parsedPrice);
            let payload = this.createERC223OrderPayload(parsedPrice, etherAddress);
            let gasPrice = yield this.getGasPrice();
            let tx = yield token.transfer(orderContract, toSuitableBigNumber(parsedAmount), payload, { gasPrice: gasPrice, gasLimit: gaslimit });
            return tx.hash;
        });
    }
    newERC20sellOrder(tokenAddress, amount, price, orderContract) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = new ethers_1.Contract(tokenAddress, erc20_json_1.default, this.wallet);
            let exchange = new ethers_1.Contract(orderContract, this.exchangeAbi, this.wallet);
            let decimals = yield token.decimals();
            let parsedAmount = new fraction_js_1.default(amount)
                .mul(new fraction_js_1.default(10).pow(Number(decimals.toString())));
            let parsedPrice = new fraction_js_1.default(price)
                .mul(new fraction_js_1.default(10).pow(etherDecimals))
                .div(new fraction_js_1.default(10).pow(Number(decimals.toString())));
            parsedPrice = new fraction_js_1.default(1).div(parsedPrice);
            yield this.verifyAllowance(token, parsedAmount, orderContract);
            let gasPrice = yield this.getGasPrice();
            let tx = yield exchange.sellERC20Token(tokenAddress, etherAddress, toSuitableBigNumber(parsedAmount), toSuitableBigNumber(parsedPrice.n), toSuitableBigNumber(parsedPrice.d), { gasPrice: gasPrice, gasLimit: gaslimit });
            return tx.hash;
        });
    }
    newERC223Trade(tokenAddress, amount, order) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = new ethers_1.Contract(tokenAddress, erc223_json_1.default, this.wallet);
            let parsedAmount = new fraction_js_1.default(amount)
                .mul(new fraction_js_1.default(10).pow(order.buytoken.decimals));
            let payload = '0x' + this.toUint(order.order_id);
            let gasPrice = yield this.getGasPrice();
            let tx = yield token.transfer(order.contract, toSuitableBigNumber(parsedAmount), payload, { gasPrice: gasPrice, gasLimit: gaslimit });
            return tx.hash;
        });
    }
    newERC20Trade(tokenAddress, amount, order) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = new ethers_1.Contract(tokenAddress, erc20_json_1.default, this.wallet);
            let exchange = new ethers_1.Contract(order.contract, this.exchangeAbi, this.wallet);
            let parsedAmount = new fraction_js_1.default(amount)
                .mul(new fraction_js_1.default(10).pow(order.buytoken.decimals));
            yield this.verifyAllowance(token, parsedAmount, order.contract);
            let gasPrice = yield this.getGasPrice();
            let tx = yield exchange.buyOrderWithERC20Token(order.order_id, tokenAddress, toSuitableBigNumber(parsedAmount), { gasPrice: gasPrice, gasLimit: gaslimit });
            return tx.hash;
        });
    }
    newEtherTrade(amount, order) {
        return __awaiter(this, void 0, void 0, function* () {
            let exchange = new ethers_1.Contract(order.contract, this.exchangeAbi, this.wallet);
            let token = new ethers_1.Contract(order.selltoken.address, erc20_json_1.default, this.wallet);
            let decimals = yield token.decimals();
            let parsedAmount = new fraction_js_1.default(amount).mul(new fraction_js_1.default(10).pow(decimals));
            let requiredEtherAmount = yield exchange.getBuyTokenAmount(toSuitableBigNumber(parsedAmount), order.order_id);
            let gasPrice = yield this.getGasPrice();
            let tx = yield exchange.buyOrderWithEth(order.order_id, { gasPrice: gasPrice, value: toSuitableBigNumber(requiredEtherAmount), gasLimit: gaslimit });
            return tx.hash;
        });
    }
    verifyCapacity(amount, order) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount > order.balance) {
                throw new Error(`
        You attempted to trade more tokens (${amount}) than are available in the order (${order.balance}) for order_tx ${order.transaction}.
      `.trim());
            }
        });
    }
    verifyAllowance(token, parsedAmount, address) {
        return __awaiter(this, void 0, void 0, function* () {
            let trader = yield this.wallet.getAddress();
            let allowance = new fraction_js_1.default((yield token.allowance(trader, address)).toString());
            if (parsedAmount.compare(allowance) > 0) {
                throw new Error(`Insufficient allowance for token ${token.address}. Please visit https://forum.saturn.network/t/saturnjs-insufficient-allowance-error/2966 to resolve`);
            }
        });
    }
    determineTokenType(address) {
        return __awaiter(this, void 0, void 0, function* () {
            let is223 = yield this.isERC223(address);
            let is20 = yield this.isERC20(address);
            if (is223) {
                return "ERC223";
            }
            if (is20) {
                return "ERC20";
            }
            throw new Error(`Token ${address} on ${this.blockchain} is of unknown type`);
        });
    }
    isERC223(address) {
        return __awaiter(this, void 0, void 0, function* () {
            let code = yield this.wallet.provider.getCode(address);
            let hash = 'be45fd62';
            return (code.indexOf(hash.slice(2, hash.length)) > 0);
        });
    }
    isERC20(address) {
        return __awaiter(this, void 0, void 0, function* () {
            let code = yield this.wallet.provider.getCode(address);
            let hash = '095ea7b3';
            return (code.indexOf(hash.slice(2, hash.length)) > 0);
        });
    }
    verifyOrderTradable(order) {
        return __awaiter(this, void 0, void 0, function* () {
            let trader = yield this.wallet.getAddress();
            if (order.owner === trader) {
                throw new Error(`Cannot trade against your own order!`);
            }
            if (!order.active) {
                throw new Error(`The order ${order.transaction} appears to no longer be active`);
            }
        });
    }
    verifyTokenBalance(tokenAddress, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = new ethers_1.Contract(tokenAddress, erc20_json_1.default, this.wallet);
            let trader = yield this.wallet.getAddress();
            let balance = new fraction_js_1.default((yield token.balanceOf(trader)).toString());
            let decimals = yield token.decimals();
            let parsedAmount = new fraction_js_1.default(amount).mul(new fraction_js_1.default(10).pow(decimals));
            if (parsedAmount.compare(balance) > 0) {
                let humanReadableBalance = balance.div(new fraction_js_1.default(10).pow(decimals)).toString();
                throw new Error(`Insufficient balance for token ${token.address}. Requested amount: ${amount}. Available amount: ${humanReadableBalance}`);
            }
        });
    }
    verifyEtherBalance(amount) {
        return __awaiter(this, void 0, void 0, function* () {
            let parsedAmount = new fraction_js_1.default(amount).mul(new fraction_js_1.default(10).pow(etherDecimals));
            let trader = yield this.wallet.getAddress();
            let unparsedBalance = yield this.wallet.provider.getBalance(trader);
            let balance = new fraction_js_1.default(unparsedBalance.toString());
            if (parsedAmount.compare(balance) > 0) {
                let humanReadableBalance = balance.div(new fraction_js_1.default(10).pow(etherDecimals)).toString();
                throw new Error(`Insufficient ether balance. Requested amount: ${amount}. Available amount: ${humanReadableBalance}`);
            }
        });
    }
    getGasPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.GAS_PRICE) {
                return Number(process.env.GAS_PRICE);
            }
            if (this.blockchain.toUpperCase() === "ETC") {
                return 1000000;
            }
            if (this.blockchain.toUpperCase() === "ETH") {
                let gasApiUrl = 'https://www.ethgasstationapi.com/api/standard';
                return (yield axios_1.default.get(gasApiUrl)).data * 1000000000;
            }
            throw new Error(`Unknown blockchain ${this.blockchain}`);
        });
    }
    verifyOrderType(orderType) {
        let types = ["buy", "sell"];
        if (!lodash_1.default.includes(types, orderType)) {
            throw new Error(`Unknown order type ${orderType}`);
        }
    }
    createERC223OrderPayload(price, buytoken) {
        let paddedToken = buytoken === '0x0' ? etherAddress : buytoken;
        return '0x' + this.toUint(price.n) + this.toUint(price.d) + paddedToken.substring(2);
    }
    toUint(num) {
        return lodash_1.default.padStart(ethers_1.utils.hexlify(num).substring(2), 64, '0');
    }
}
exports.Web3Interface = Web3Interface;
