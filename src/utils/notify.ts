import Notify from 'bnc-notify';

const BLOCKNATIVE_KEY = process.env.REACT_APP_BLOCKNATIVE_KEY;

export const networkIdToUrl = {
  '1': 'https://etherscan.io/tx',
  '4': 'https://rinkeby.etherscan.io/tx',
}

// eslint-disable-next-line import/prefer-default-export
export const createNotify = (networkId: number) => Notify({
  dappId: BLOCKNATIVE_KEY,
  networkId: networkId,
});
