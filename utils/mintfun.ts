import { Hex } from "viem"
import { random } from "./common"

export function getRandomContract(contracts: string[]) {
    return contracts[random(0, contracts.length-1)] as Hex
}