export enum SupportedNetworks {
  Mainnet = 1,
  Ropsten = 3,
  Kovan = 42,
}

export const networkIdToTxUrl = {
  '1': 'https://etherscan.io/tx',
  '3': 'https://ropsten.etherscan.io/tx',
  '42': 'https://kovan.etherscan.io/tx',
}

export const networkIdToAddressUrl = {
  '1': 'https://etherscan.io/address',
  '3': 'https://ropsten.etherscan.io/address',
  '42': 'https://kovan.etherscan.io/address',
}
