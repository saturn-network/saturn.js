"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
exports.etherAddress = '0x0000000000000000000000000000000000000000';
exports.etherDecimals = 18;
exports.gaslimit = 400000;
