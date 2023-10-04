export const generalConfig = {
    sleepFrom: 60,
    sleepTo: 150,
    shuffleWallets: false
}

export const bridgeConfig = {
    type: 'stargate', // 'stargate', 'official'
    stargateFrom: 'arbitrum', // 'arbitrum', 'optimism'
    bridgeFrom: 0.001,
    bridgeFo: 0.002,
    stargateBridgeFrom: 0.003,
    stargateBridgeTo: 0.004,
}

export const binance = {
    key: '',
    secret: ''
}

export const mintfunConfig = {
    countFrom: 1,
    countTo: 2
}

export const swapConfig = {
    swapEthPercentFrom: 50,
    swapEthPercentTo: 60
}