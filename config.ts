export const generalConfig = {
    ethrpc: 'https://rpc.ankr.com/eth',
    baserpc: 'https://rpc.ankr.com/base',
    sleepFrom: 60,
    sleepTo: 150,
    shuffleWallets: false,
    shuffleCustomModules: true,
    maxGas: 15,
    countModulesFrom: 1, // сколько кастом модулей сделать
    countModulesTo: 3,
    customModules: ['l2telegraph', 'mintfun', 'uniswap']
    // 'aave', 'baseswap', 'l2telegraph', 'l2telegraph_message', 'merkly', 'mintfun', 'odos', 'pancake', 'uniswap', 'woofi', 'alienswap', 'bungee'
}

export const bridgeConfig = {
    type: 'official', // 'stargate', 'official'
    stargateFrom: 'arbitrum', // 'arbitrum', 'optimism', 'random'
    bridgeFrom: 0.001,
    bridgeTo: 0.002,
    stargateBridgeFrom: 0.003,
    stargateBridgeTo: 0.004,
    maxGas: 10 // for official bridge Eth -> Base
}

export const binanceConfig = {
    key: '',
    secret: '',
    withdrawFrom: 0.001, // min: 0.001
    withdrawTo: 0.0013,
    useRefill: false
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
    useProxy: true,
    useReferral: true
}

export const openoceanConfig = {
    useReferral: true
}

export const merklyConfig = {
    refuelFrom: 0.00001,
    refuelTo: 0.00002,
    destinationNetwork: 'random' // 'Zora' 'Arbitrum Nova' 'Moonbeam' 'Gnosis' 'OpBNB' 'Astar'
}

export const l2telegraphMessageConfig = {
    maxMessageCost: 0.00030
}

export const zeriusConfig = {
    destinationNetworks: [195, 111]
    // "zora": 195,
    // "optimism": 111,
    // "polygon": 109,
    // "bsc": 102,
    // "avalanche": 106,
    // "arbitrum": 110,
}

export const bungeeConfig = {
    refuelFrom: 0.0025, // min: 0.0025
    refuelTo: 0.0035,
    destinationNetwork: 'random' // bsc, polygon, arbitrum, avalanche, zksync, zkevm
}