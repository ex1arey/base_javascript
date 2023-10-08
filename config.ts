export const generalConfig = {
    sleepFrom: 60,
    sleepTo: 150,
    shuffleWallets: true
}

export const bridgeConfig = {
    type: 'stargate', // 'stargate', 'official'
    stargateFrom: 'arbitrum', // 'arbitrum', 'optimism', 'random'
    bridgeFrom: 0.001,
    bridgeTo: 0.002,
    stargateBridgeFrom: 0.003,
    stargateBridgeTo: 0.004,
    maxGas: 10 // for official bridge Eth -> Base
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
    swapEthPercentFrom: 20,
    swapEthPercentTo: 30
}

export const aaveConfig = {
    depositEthPercentFrom: 20,
    depositEthPercentTo: 30,
    makeWithdraw: true
}

export const odosConfig = {
    useProxy: false,
    useReferral: true
}