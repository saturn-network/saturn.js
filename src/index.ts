import { Signer } from 'ethers'
import { RequestManager } from './request_manager'
import { Web3Interface } from './exchange'

import _ from 'lodash'

interface Web3Options {
  eth?: Signer,
  etc?: Signer
}

export class Saturn {
  readonly query: RequestManager
  readonly eth?: Web3Interface
  readonly etc?: Web3Interface

  constructor(apiurl: string, wallets?: Web3Options) {
    if (_.endsWith(apiurl, '/')) { apiurl = apiurl.slice(0, -1) }
    this.query = new RequestManager(apiurl)
    if (wallets) {
      if (wallets.eth) {
        this.eth = this.setWallet(wallets.eth, "ETH", this.query)
      }
      if (wallets.etc) {
        this.etc = this.setWallet(wallets.etc, "ETC", this.query)
      }
    }
  }

  private setWallet(
    wallet: Signer,
    blockchain: string,
    requestManager: RequestManager
  ) : Web3Interface {
    return new Web3Interface(wallet, blockchain, requestManager)
  }
}
