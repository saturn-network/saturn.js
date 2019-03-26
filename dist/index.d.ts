import { Signer } from 'ethers';
import { RequestManager } from './request_manager';
import { Web3Interface } from './exchange';
interface Web3Options {
    eth?: Signer;
    etc?: Signer;
}
export declare class Saturn {
    readonly query: RequestManager;
    readonly eth?: Web3Interface;
    readonly etc?: Web3Interface;
    constructor(apiurl: string, wallets?: Web3Options);
    private setWallet;
}
export {};
