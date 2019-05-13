import fromExponential from 'from-exponential'
import Fraction from 'fraction.js'
import axios from 'axios'

import includes from 'lodash/includes'
import padStart from 'lodash/padStart'

import { Signer, Contract, utils } from 'ethers'
import { FunctionFragment, BigNumber } from 'ethers/utils'

import { RequestManager } from '../request_manager'
import { Order } from './types'
import { etherDecimals, etherAddress, gaslimit } from '../utils'

import exchange from './exchangeConfig.json'
import erc223 from './erc223.json'
import erc20 from './erc20.json'

const BigNumberJS = require('bignumber.js')

let toSuitableBigNumber = function(n : number | String | BigNumber | Fraction) : BigNumber {
  if (n instanceof BigNumber) { return n }
  if (n instanceof Fraction) { return utils.bigNumberify(fromExponential(n.valueOf())) }
  try {
    return utils.bigNumberify(n.valueOf())
  } catch(e) {
    let tmp = utils.bigNumberify(n.toString())
    if (tmp.toString() !== n.toString()) { throw e }
    return tmp
  }
}

export class Web3Interface {
  readonly wallet: Signer
  readonly blockchain: string
  readonly query: RequestManager
  private exchangeAbi: Object

  constructor(wallet: Signer, blockchain: string, requestManager: RequestManager) {
    this.wallet = wallet
    this.blockchain = blockchain
    this.query = requestManager
    this.exchangeAbi = exchange.abi
  }

  async newTrade(amount_1: number | string, orderTx: string) {
    let amount = new BigNumberJS(amount_1)
    let order = await this.query.awaitOrderTx(orderTx, this.blockchain)
    await this.verifyCapacity(amount.toFixed(), order)
    await this.verifyOrderTradable(order)

    if (order.type.toLowerCase() === "sell") {
      return (await this.newEtherTrade(amount.toFixed(), order))
    } else if (order.type.toLowerCase() === "buy") {
      let tokenAddress = order.buytoken.address
      let tokenType = await this.determineTokenType(tokenAddress)
      if (tokenType === "ERC223") {
        return (await this.newERC223Trade(tokenAddress, amount.toFixed(), order))
      } else {
        return (await this.newERC20Trade(tokenAddress, amount.toFixed(), order))
      }
    } else {
      throw new Error(`Unknown order type for order_tx ${orderTx} on ${this.blockchain}`)
    }
  }

  async newOrder(tokenAddress: string, orderType: string, amount_1: number | string, price_1: number | string) {
    let amount = new BigNumberJS(amount_1)
    let price = new BigNumberJS(price_1)
    this.verifyOrderType(orderType)
    let tokenType = await this.determineTokenType(tokenAddress)
    let orderContract = await this.query.getExchangeContract(this.blockchain) as string
    if (orderType === "buy") {
      await this.verifyEtherBalance(amount.times(price))
      return (await this.newBuyOrder(tokenAddress, amount.toFixed(), price.toFixed(), orderContract))
    } else if (orderType === "sell") {
      await this.verifyTokenBalance(tokenAddress, amount.toFixed())
      if (tokenType === "ERC223") {
        return (await this.newERC223sellOrder(tokenAddress, amount.toFixed(), price.toFixed(), orderContract))
      } else {
        return (await this.newERC20sellOrder(tokenAddress, amount.toFixed(), price.toFixed(), orderContract))
      }
    } else {
      throw new Error(`Unknown order type ${orderType}`)
    }
  }

  async cancelOrder(orderId: number, contract: string) : Promise<string> {
    let exchange = new Contract(contract, this.exchangeAbi as any, this.wallet)
    let gasPrice = await this.getGasPrice()
    let tx = await exchange.cancelOrder(
      orderId,
      { gasPrice: gasPrice, gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async newBuyOrder(tokenAddress: string, amount_1: number | string, price_1: number | string,
      orderContract: string) : Promise<string> {

    let amount = new BigNumberJS(amount_1)
    let price = new BigNumberJS(price_1)

    // we just want to query for decimals, erc20 and erc223 have same method
    let token = new Contract(tokenAddress, erc20 as FunctionFragment[], this.wallet)
    let exchange = new Contract(orderContract, this.exchangeAbi as any, this.wallet)
    let decimals = await token.decimals()

    let priceMul = new BigNumberJS(price).shiftedBy(etherDecimals)   //
    let priceDiv = new BigNumberJS(1).shiftedBy(decimals)            // in future we should not need to have these

    let parsedAmount = amount.times(price).shiftedBy(etherDecimals)

    let gasPrice = await this.getGasPrice()

    let tx = await exchange.sellEther(
      tokenAddress,
      toSuitableBigNumber(priceMul.toFixed()),
      toSuitableBigNumber(priceDiv.toFixed()),
      { gasPrice: gasPrice, value: toSuitableBigNumber(parsedAmount.toFixed()), gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async newERC223sellOrder(tokenAddress: string, amount_1: number | string, price_1: number | string,
       orderContract: string) : Promise<string> {

    let amount = new BigNumberJS(amount_1)
    let price = new BigNumberJS(price_1)

    let token = new Contract(tokenAddress, erc223 as FunctionFragment[], this.wallet)
    let decimals = await token.decimals()
    let parsedAmount = amount.shiftedBy(decimals)

    let priceDiv = price.shiftedBy(etherDecimals)                    //
    let priceMul = new BigNumberJS(1).shiftedBy(decimals)            // This is a mess replacing a mess and probably wrong

    let payload = this.createERC223OrderPayload(priceMul.toFixed(), priceDiv.toFixed(), etherAddress)
    let gasPrice = await this.getGasPrice()

    let tx = await token.transfer(
      orderContract,
      toSuitableBigNumber(parsedAmount.toFixed()),
      payload,
      { gasPrice: gasPrice, gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async newERC20sellOrder(tokenAddress: string, amount_1: number | string, price_1: number | string,
       orderContract: string) : Promise<string> {

    let amount = new BigNumberJS(amount_1)
    let price = new BigNumberJS(price_1)

    let token = new Contract(tokenAddress, erc20 as FunctionFragment[], this.wallet)
    let exchange = new Contract(orderContract, this.exchangeAbi as any, this.wallet)
    let decimals = await token.decimals()

    let parsedAmount = amount.shiftedBy(decimals)

    let priceDiv = price.shiftedBy(etherDecimals)                     //
    let priceMul = new BigNumberJS(1).shiftedBy(decimals)             // this is a mess replacing a mess

    await this.verifyAllowance(token, parsedAmount.toFixed(), orderContract)
    let gasPrice = await this.getGasPrice()

    let tx = await exchange.sellERC20Token(
      tokenAddress,
      etherAddress,
      toSuitableBigNumber(parsedAmount.toFixed()),
      toSuitableBigNumber(priceMul.toFixed()),
      toSuitableBigNumber(priceDiv.toFixed()),
      { gasPrice: gasPrice, gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async newERC223Trade(tokenAddress: string, amount_1: number| string, order: Order) : Promise<string> {
    let amount = new BigNumberJS(amount_1)
    let token = new Contract(tokenAddress, erc223, this.wallet)

    let parsedAmount = amount.shiftedBy(order.buytoken.decimals)

    let payload = '0x' + this.toUint(order.order_id)
    let gasPrice = await this.getGasPrice()

    let tx = await token.transfer(
      order.contract,
      toSuitableBigNumber(parsedAmount.toFixed()),
      payload,
      { gasPrice: gasPrice, gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async newERC20Trade(tokenAddress: string, amount_1: number | string, order: Order) : Promise<string> {
    let amount = new BigNumberJS(amount_1)
    let token = new Contract(tokenAddress, erc20 as FunctionFragment[], this.wallet)
    let exchange = new Contract(order.contract, this.exchangeAbi as any, this.wallet)

    let parsedAmount = amount.shiftedBy(order.buytoken.decimals)

    await this.verifyAllowance(token, parsedAmount.toFixed(), order.contract)
    let gasPrice = await this.getGasPrice()

    let tx = await exchange.buyOrderWithERC20Token(
      order.order_id,
      tokenAddress,
      toSuitableBigNumber(parsedAmount.toFixed()),
      { gasPrice: gasPrice, gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async newEtherTrade(amount_1: number | string, order: Order) : Promise<string> {
    let amount = new BigNumberJS(amount_1)
    let exchange = new Contract(order.contract, this.exchangeAbi as any, this.wallet)
    let token = new Contract(order.selltoken.address, erc20 as FunctionFragment[], this.wallet)
    let decimals = await token.decimals()
    let parsedAmount = amount.shiftedBy(decimals)
    let requiredEtherAmount = await exchange.getBuyTokenAmount(
      toSuitableBigNumber(parsedAmount.toFixed()),
      order.order_id
    )
    let gasPrice = await this.getGasPrice()

    let tx = await exchange.buyOrderWithEth(
      order.order_id,
      { gasPrice: gasPrice, value: toSuitableBigNumber(requiredEtherAmount), gasLimit: gaslimit }
    )
    return tx.hash
  }

  private async verifyCapacity(amount_1: number | string, order: Order) {
    let amount = new BigNumberJS(amount_1)
    if (amount.gt(BigNumberJS(order.balance))) {
      throw new Error(`
        You attempted to trade more tokens (${amount.toFixed()}) than are available in the order (${order.balance}) for order_tx ${order.transaction}.
      `.trim())
    }
  }

  private async verifyAllowance(token: Contract, parsedAmount_1: string, address: string) {
    let parsedAmount = new BigNumberJS(parsedAmount_1)
    let trader = await this.wallet.getAddress()
    let allowance = new BigNumberJS((await token.allowance(trader, address)).toFixed())
    if (parsedAmount.gt(allowance)) {
      throw new Error(`Insufficient allowance for token ${token.address}. Please visit https://forum.saturn.network/t/saturnjs-insufficient-allowance-error/2966 to resolve`)
    }
  }

  private async determineTokenType(address: string) : Promise<string | Error> {
    let is223 = await this.isERC223(address)
    let is20  = await this.isERC20(address)

    if (is223) { return "ERC223" }
    if (is20)  { return "ERC20"  }
    throw new Error(`Token ${address} on ${this.blockchain} is of unknown type`)
  }

  private async isERC223(address: string) : Promise<boolean> {
    let code = await this.wallet.provider.getCode(address)
    let hash = 'be45fd62'
    return (code.indexOf(hash.slice(2, hash.length)) > 0)
  }

  private async isERC20(address: string) : Promise<boolean> {
    let code = await this.wallet.provider.getCode(address)
    let hash = '095ea7b3'
    return (code.indexOf(hash.slice(2, hash.length)) > 0)
  }

  private async verifyOrderTradable(order: Order) {
    let trader = await this.wallet.getAddress()
    if (order.owner === trader) {
      throw new Error(`Cannot trade against your own order!`)
    }
    if (!order.active) {
      throw new Error(`The order ${order.transaction} appears to no longer be active`)
    }
  }

  private async verifyTokenBalance(tokenAddress: string, amount_1: number | string) {
    let amount = new BigNumberJS(amount_1)
    let token = new Contract(tokenAddress, erc20 as FunctionFragment[], this.wallet)
    let trader = await this.wallet.getAddress()
    let balance = new BigNumberJS((await token.balanceOf(trader)).toString())

    let decimals = await token.decimals()
    let parsedAmount = amount.shiftedBy(decimals)


    if (parsedAmount.gt(balance)) {
      let humanReadableBalance = balance.shiftedBy(-decimals).toFixed()
      throw new Error(`Insufficient balance for token ${token.address}. Requested amount: ${amount}. Available amount: ${humanReadableBalance}`)
    }
  }

  private async verifyEtherBalance(amount_1: number| string) {
    let amount = new BigNumberJS(amount_1)
    let parsedAmount = amount.shiftedBy(etherDecimals)
    let trader = await this.wallet.getAddress()
    let unparsedBalance = await this.wallet.provider.getBalance(trader)
    let balance = new BigNumberJS(unparsedBalance.toString())

    if (parsedAmount.gt(balance)) {
      let humanReadableBalance = balance.shiftedBy(-etherDecimals).toFixed()
      throw new Error(`Insufficient ether balance. Requested amount: ${amount}. Available amount: ${humanReadableBalance}`)
    }
  }

  private async getGasPrice() : Promise<number> {
    if (process.env.GAS_PRICE) {
      return Number(process.env.GAS_PRICE)
    }
    if (this.blockchain.toUpperCase() === "ETC") {
      return 1000000
    }
    if (this.blockchain.toUpperCase() === "ETH") {
      let gasApiUrl = 'https://www.ethgasstationapi.com/api/standard'
      return (await axios.get(gasApiUrl)).data * 1000000000
    }
    throw new Error(`Unknown blockchain ${this.blockchain}`)
  }

  private verifyOrderType(orderType: string) {
    let types = ["buy", "sell"]
    if (!includes(types, orderType)) {
      throw new Error(`Unknown order type ${orderType}`)
    }
  }

  private createERC223OrderPayload(priceMul: string, priceDiv: string, buytoken: string) : string {
    let paddedToken = buytoken === '0x0' ? etherAddress : buytoken
    return '0x' + this.toUint(priceMul) + this.toUint(priceDiv) + paddedToken.substring(2)
  }

  private toUint(num : number | string) : string {
    return padStart(utils.hexlify(toSuitableBigNumber(num)).substring(2), 64, '0')
  }
}
