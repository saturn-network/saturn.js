# saturn-js
Javascript client for interacting with Saturn Network decentralized exchange and
DAO tools.

The library depends on ethers.js library for interacting with the blockchain.
This means that all tools within the ecosystem of ethers.js are available to
be used with saturn.js. Some examples and helpful links include:

* [ethers.js library](https://github.com/ethers-io/ethers.js)
* [Ledger Nano support](https://github.com/ethers-io/ethers-ledger)
* [Using saturn.js with Saturn Wallet and Metamask](https://docs.ethers.io/ethers.js/html/cookbook-providers.html#metamask)

This library is written with CLI usage and ES6 and TypeScript in mind. Most exposed
methods return promises to support easy `async => await`.

### Installation

To add to your node.js or typescript project, do the following

```
npm i -s ethers @saturnnetwork/saturn.js
```

### Usage in browser

Use a modern build tool like webpack or rollup in order to use npm packages in the browser.

### Usage for TypeScript / ES6

```js
import { JsonRpcProvider } from 'ethers/providers'
import { Wallet } from 'ethers'
import { Saturn } from '@saturnnetwork/saturn.js'

let etcnode = 'https://ethereumclassic.network/'
let ethnode = '' // get yours at infura.io
let saturnApi = 'https://ticker.saturn.network/api/v2/'
let etcprovider = new JsonRpcProvider(etcnode, { chainId: 61, name: 'etc' })
let ethprovider = new JsonRpcProvider(ethnode, { chainId: 1, name: 'eth' })
let mm = "your twelve word private key mnemonic"
let etcwallet = Wallet.fromMnemonic(mm).connect(etcprovider)
// By default ethers.js will pick your first saturn wallet's address when you
// give a mnemonic. In order to get second address, do this
// let etcwallet2 = Wallet.fromMnemonic(mm, "m/44'/60'/0'/0/1").connect(etcprovider)
// Third wallet, this...
// let etcwallet3 = Wallet.fromMnemonic(mm, "m/44'/60'/0'/0/2").connect(etcprovider)
let ethwallet = Wallet.fromMnemonic(mm).connect(ethprovider)
let saturn = new Saturn(saturnApi, {etc: etcwallet, eth: ethwallet})
```

### Usage for ES5 / JavaScript

```js
var ethers = require('ethers')
var Saturn = require('@saturnnetwork/saturn.js').Saturn

var etcnode = 'https://ethereumclassic.network/'
var ethnode = '' // get yours at infura.io
var saturnApi = 'https://ticker.saturn.network/api/v2/'
var etcprovider = new ethers.providers.JsonRpcProvider(etcnode, { chainId: 61, name: 'etc' })
var ethprovider = new ethers.providers.JsonRpcProvider(ethnode, { chainId: 1, name: 'eth' })
var mm = "radar blur cabbage chef fix engine embark joy scheme fiction master release"
var etcwallet = new ethers.Wallet.fromMnemonic(mm).connect(etcprovider)
var ethwallet = new ethers.Wallet.fromMnemonic(mm).connect(ethprovider)
var saturn = new Saturn(saturnApi, {etc: etcwallet, eth: ethwallet})
```

### Methods

Reading data

```js
// some helpful shared variables
let token = '0xac55641cbb734bdf6510d1bbd62e240c2409040f'
let blockchain = 'ETC'
```
```js
// query for all active orders for address
saturn.query.ordersForAddress(etcwallet.address).then(console.log)
```
```js
// query for a token's trade history
saturn.query.tradeHistory(token, blockchain).then(console.log)
```
```js
// query for a token's ohlcv data
saturn.query.ohlcv(token, blockchain).then(console.log)
```
```js
// query for a token's active order book
saturn.query.orderbook(token, blockchain).then(console.log)
```
```js
// query for a token's summary
saturn.query.getTokenInfo(token, blockchain).then(console.log)
```

Writing data (requires an ethers.js wallet)

```js
// create a BUY order for 10000 tokens at 0.00008 price
// use 'sell' for sell orders
saturn.etc.newOrder(tkn, 'buy', 10000, 0.00008).then(async (orderTx) => {
  // Optionally, await for new order transaction to be mined into a block
  return await saturn.query.awaitOrderTx(orderTx, saturn.etc)
})
```

```js
// cancel order
// extract order_id and order_contract from an active order
// i.e. by using saturn.query.ordersForAddress(etcwallet.address)
saturn.etc.cancelOrder(order_id, order_contract).then(async (tx) => {
  // Optionally, await this transaction to be mined into a block
  return await saturn.query.awaitTransaction(tx, saturn.etc, `Awaiting cancellation ${tx}`)
})
```

```js
// trade
// first, find an attractive order, i.e.
await saturn.query.tokenInfo(token, blockchain).then(async (summary) => {
  // now buy 80 tokens if you like the price
  let tradeTx = await saturn.etc.newTrade(80, summary.best_sell_order_tx)
  return await saturn.query.awaitTradeTx(tradeTx, saturn.etc)
})
```
