import { privateKeyConvert, readWallets } from "./utils/wallet"
import { random, randomFloat, shuffle, sleep } from "./utils/common"
import { bridgeConfig, generalConfig, mintfunConfig } from "./config"
import { makeLogger } from "./utils/logger"
import { entryPoint } from "./utils/menu"
import { Bridge } from "./modules/bridge"
import { Mintfun } from "./modules/mintfun"
import { L2Telegraph } from "./modules/l2telegraph"
import { Merkly } from "./modules/merkly"
import { Baseswap } from "./modules/baseswap"

let privateKeys = readWallets('./private_keys.txt')

if (generalConfig.shuffleWallets) {
    shuffle(privateKeys)
}

async function bridgeModule() {
    const logger = makeLogger("Bridge")
    for (let privateKey of privateKeys) {
        const bridge = new Bridge(privateKeyConvert(privateKey))
        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        const sum = randomFloat(bridgeConfig.stargateBridgeFrom, bridgeConfig.stargateBridgeTo)

        if (bridgeConfig.type === 'stargate') {
            if (bridgeConfig.stargateFrom === 'arbitrum') {
                await bridge.stargateArbitrumToBase(sum.toString())
            } else {
                await bridge.stargateOptimismToBase(sum.toString())
            }
        } else {
            await bridge.bridge(sum.toString())
        }
        
        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function mintfunModule() {
    const logger = makeLogger("Mintfun")
    for (let privateKey of privateKeys) {
        const mintfun = new Mintfun(privateKeyConvert(privateKey))
        const txCount = random(mintfunConfig.countFrom, mintfunConfig.countTo)

        for (let i = 1; i <= txCount; i++) {
            const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
            await mintfun.mintRandom()

            if (txCount > 1) {
                logger.info(`Waiting ${sleepTime} sec until next mint...`)
                await sleep(sleepTime * 1000)
            }
        }

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function l2telegraphModule() {
    const logger = makeLogger("L2Telegraph")
    for (let privateKey of privateKeys) {
        const l2telegraph = new L2Telegraph(privateKeyConvert(privateKey))

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        await l2telegraph.mintAndBridge()

        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function l2telegraphMessageModule() {
    const logger = makeLogger("L2Telegraph")
    for (let privateKey of privateKeys) {
        const mintfun = new L2Telegraph(privateKeyConvert(privateKey))

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        await mintfun.sendMessage()

        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function merklyRefuelModule() {
    const logger = makeLogger("Merkly")
    for (let privateKey of privateKeys) {
        const mintfun = new Merkly(privateKeyConvert(privateKey))

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        await mintfun.refuel()

        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function randomModuleModule() {
    const logger = makeLogger("Random")
    for (let privateKey of privateKeys) {
        const randomChooice = random(1, 2)
        let sleepTime

        if (randomChooice === 1) {
            const mintfun = new Mintfun(privateKeyConvert(privateKey))
            sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
            await mintfun.mintRandom()
        } else {
            const l2telegraph = new L2Telegraph(privateKeyConvert(privateKey))
            sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
            await l2telegraph.mintAndBridge()
        }

        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function baseswapModule() {
    const logger = makeLogger("Baseswap")
    for (let privateKey of privateKeys) {
        const baseswap = new Baseswap(privateKeyConvert(privateKey))

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        await baseswap.roundSwap()

        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function startMenu() {
    let mode = await entryPoint()
    switch (mode) {
        case "bridge":
            await bridgeModule()
            break
        case "merkly":
            await merklyRefuelModule()
            break
        case "baseswap":
            await baseswapModule()
            break
        case "mintfun":
            await mintfunModule()
            break
        case "l2telegraph":
            await l2telegraphMessageModule()
            break
        case "l2telegraph_message":
            await l2telegraphMessageModule()
            break
        case "random":
            await randomModuleModule()
            break
    }
}

await startMenu()