import {balanceEth, balanceBase} from "./onchain/getBalance"
import {getBaseWalletClient} from "./utils/baseClient"
import {Hex} from "viem"
import { Bridge } from "./modules/bridge"
import { privateKeyConvert, readWallets } from "./utils/wallet"
import { random, randomFloat, sleep } from "./utils/common"
import { bridgeConfig, mintfunConfig } from "./config"
import { makeLogger } from "./utils/logger"
import { entryPoint } from "./utils/menu"
import { Mintfun } from "./modules/mintfun"

const privateKeys = readWallets('./private_keys.txt')

async function bridge() {
    const logger = makeLogger("Bridge")
    for (let privateKey of privateKeys) {
        const bridge = new Bridge(privateKeyConvert(privateKey))
        const sleepTime = random(bridgeConfig.sleep_from, bridgeConfig.sleep_to)
        const sum = randomFloat(bridgeConfig.stargate_bridge_from, bridgeConfig.stargate_bridge_to)

        if (bridgeConfig.type === 'stargate') {
            if (bridgeConfig.stargate_from === 'arbitrum') {
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

async function mintfun() {
    const logger = makeLogger("Mintfun")
    for (let privateKey of privateKeys) {
        const mintfun = new Mintfun(privateKeyConvert(privateKey))
        const txCount = random(mintfunConfig.count_tx_from, mintfunConfig.count_tx_to)

        for (let i = 1; i <= txCount; i++) {
            const sleepTime = random(mintfunConfig.sleep_from, mintfunConfig.sleep_to)
            await mintfun.mintRandom()

            if (txCount > 1) {
                logger.info(`Waiting ${sleepTime} sec until next mint...`)
                await sleep(sleepTime * 1000)
            }
        }

        const sleepTime = random(mintfunConfig.sleep_from, mintfunConfig.sleep_to)
        logger.info(`Waiting ${sleepTime} sec until next wallet...`)
        await sleep(sleepTime * 1000)
    }
}

async function startMenu() {
    let mode = await entryPoint()
    switch (mode) {
        case "bridge":
            await bridge()
            break
        case "mintfun":
            await mintfun()
            break
    }
}

await startMenu()