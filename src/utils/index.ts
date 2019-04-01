export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const etherAddress = '0x0000000000000000000000000000000000000000' as const
export const etherDecimals = 18 as const
export const gaslimit = 400000 as const
