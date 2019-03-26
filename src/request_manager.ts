import axios from 'axios'
import ora from 'ora'

import { Transaction, Order, Trade, Token } from './exchange/types'
import { Web3Interface } from './exchange'
import { sleep } from './utils'

const etherAddress = '0x0000000000000000000000000000000000000000'

class TxFailedError extends Error {}

export class RequestManager {
  readonly apiurl: string

  constructor(url: string) {
    this.apiurl = url
  }

  async getTransaction(tx: string, blockchain: string) : Promise<Transaction | Error> {
    let url = `${this.apiurl}/transactions/${blockchain}/${tx}.json`
    let response = await axios.request<Transaction>({
      url: url, headers: {'Origin': 'saturnjs'}
    }).catch(error => {
      return Promise.reject(new Error(error.response))
    })
    let transaction: Transaction = response.data
    return transaction
  }

  async getOrderByTx(tx: string, blockchain: string) : Promise<Order | Error> {
    let url = `${this.apiurl}/orders/by_tx/${blockchain}/${tx}.json`
    let response = await axios.request<Order>({
      url: url, headers: {'Origin': 'saturnjs'}
    }).catch(error => {
      return Promise.reject(new Error(error.response))
    })
    let order: Order = response.data
    return order
  }

  async awaitOrderTx(tx: string, blockchain: string | Web3Interface ) : Promise<Order> {
    await this.awaitTransaction(tx, blockchain, `Awaiting order ${tx}`)
    let order: Order = await this.getOrderByTx(tx, this.blockchainName(blockchain)) as Order
    return order
  }

  async getTradeByTx(tx: string, blockchain: string) : Promise<Trade | Error> {
    let url = `${this.apiurl}/trades/by_tx/${blockchain}/${tx}.json`
    let response = await axios.request<Trade>({
      url: url, headers: {'Origin': 'saturnjs'}
    }).catch(error => {
      return Promise.reject(new Error(error.response))
    })
    let trade: Trade = response.data
    return trade
  }

  async awaitTradeTx(tx: string, blockchain: string | Web3Interface) : Promise<Trade> {
    await this.awaitTransaction(tx, blockchain, `Awaiting trade ${tx}`)
    let trade: Trade = await this.getTradeByTx(tx, this.blockchainName(blockchain)) as Trade
    return trade
  }

  async getTokenInfo(address: string, blockchain: string) : Promise<Token | Error> {
    let url = `${this.apiurl}/tokens/show/${blockchain}/${address}.json`
    let response = await axios.request<Token>({
      url: url, headers: {'Origin': 'saturnjs'}
    }).catch(error => {
      return Promise.reject(new Error(error.response))
    })
    let token: Token = response.data
    return token
  }

  async awaitTransaction(tx: string, blockchain: string | Web3Interface, text?: string) : Promise<Transaction> {
    let transaction: Transaction | Error, spinner : any
    if (!text) {
      text = `Awaiting transaction ${tx}`
    }
    if (this.isCLI()) {
      spinner = ora({
        text: text,
        color: this.pickColor(this.blockchainName(blockchain))
      }).start()
    }
    if (blockchain instanceof Web3Interface) {
      try {
        await blockchain.wallet.provider.waitForTransaction(tx)
        let receipt = await blockchain.wallet.provider.getTransactionReceipt(tx)
        // dirty hack for ETC
        // can remove the gasUsed check once ETC merges ECIPs for Byzantium
        const gaslimit = '400000'
        if (receipt.status === 0 || receipt.gasUsed.toString() === gaslimit) {
          throw new TxFailedError(`Transaction ${tx} on ${this.blockchainName(blockchain)} failed.`)
        }
      } catch (e) {
        if (e instanceof TxFailedError) {
          if (spinner) {
            spinner.clear()
            spinner.stop()
          }
          throw e
        }
      }
    }
    while (true) {
      try {
        transaction = await this.getTransaction(tx, this.blockchainName(blockchain))
        if (spinner) {
          spinner.clear()
          spinner.stop()
        }
        break
      } catch (e) {
        await sleep(5000)
      }
    }
    return transaction as Transaction
  }

  async getExchangeContract(blockchain: string) : Promise<string | Error> {
    let url = `${this.apiurl}/orders/contracts.json`
    let result = (await axios.get(url)).data[blockchain.toUpperCase()]
    if (result == null) {
      return Promise.reject(new Error(`Unable to fetch contract address for blockchain ${blockchain}`))
    }
    return result
  }

  async ordersForAddress(address: string) : Promise<Array<Order>> {
    let url = `${this.apiurl}/orders/trader/${address}.json`
    let result : any = await axios.get(url)
    if (result == null) {
      return Promise.reject(new Error(`Unable to fetch orders for address ${address}`))
    }
    return result.data.buy_orders.concat(result.data.sell_orders)
  }

  async orderbook(token: string, blockchain: string) : Promise<object> {
    let url = `${this.apiurl}/orders/${blockchain}/${token}/${etherAddress}/all.json`
    let result : any = await axios.get(url)
    if (result == null) {
      return Promise.reject(new Error(`Unable to fetch orderbook for token ${blockchain}:${token}`))
    }
    return result.data
  }

  async ohlcv(token: string, blockchain: string) : Promise<object> {
    let url = `${this.apiurl}/tokens/ohlcv/${blockchain}/${token}/24h.json`
    let result : any = await axios.get(url)
    if (result == null) {
      return Promise.reject(new Error(`Unable to fetch ohlcv for token ${blockchain}:${token}`))
    }
    return result.data
  }

  async tradeHistory(token: string, blockchain: string) : Promise<object> {
    let url = `${this.apiurl}/trades/${blockchain}/${token}/${etherAddress}/all.json`
    let result : any = await axios.get(url)
    if (result == null) {
      return Promise.reject(new Error(`Unable to fetch trade history for token ${blockchain}:${token}`))
    }
    return result.data
  }

  private pickColor(blockchain: string) : string {
    let b = blockchain.toUpperCase()
    if (b == 'ETH') { return 'gray' }
    if (b == 'ETC') { return 'green'  }
    throw new Error('Unknown blockchain')
  }

  private blockchainName(obj: string | Web3Interface ) : string {
    return obj instanceof Web3Interface ? obj.blockchain : obj
  }

  private isCLI() : boolean {
    return !(typeof window !== 'undefined' && typeof window.document !== 'undefined')
  }
}
