import {formatEther} from "viem"
import {getPublicEthClient} from "../utils/ethClient";
import {getPublicBaseClient} from "../utils/baseClient";

const ethClient = getPublicEthClient()
const baseClient = getPublicBaseClient()

export const balanceEth = formatEther(await ethClient.getBalance({
    address: '0x2300f68064BfaafA381cd36f2695CDfEAAc09231',
}))

export const balanceBase = formatEther(await baseClient.getBalance({
    address: '0x2300f68064BfaafA381cd36f2695CDfEAAc09231',
}))