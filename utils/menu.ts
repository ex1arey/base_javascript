import inquirer from "inquirer"

export const entryPoint = async () => {
    const questions = [
        {
            name: "choice",
            type: "list",
            message: "Действие:",
            choices: [
                {
                    name: "Custom module",
                    value: "custom",
                },
                {
                    name: "Random module",
                    value: "random",
                },
                {
                    name: "Random swap module",
                    value: "random_swap",
                },
                {
                    name: "Random L0 module",
                    value: "random_l0",
                },
                {
                    name: "Bridge",
                    value: "bridge",
                },
                {
                    name: "Binance withdraw",
                    value: "binance",
                },
                {
                    name: "Merkly",
                    value: "merkly",
                },
                {
                    name: "Bungee",
                    value: "bungee",
                },
                {
                    name: "Alienswap",
                    value: "alienswap",
                },
                {
                    name: "Baseswap",
                    value: "baseswap",
                },
                {
                    name: "Woofi",
                    value: "woofi",
                },
                {
                    name: "Uniswap",
                    value: "uniswap",
                },
                {
                    name: "Pancake",
                    value: "pancake",
                },
                {
                    name: "Odos",
                    value: "odos",
                },
                {
                    name: "Openocean",
                    value: "openocean",
                },
                {
                    name: "Aave",
                    value: "aave",
                },
                {
                    name: "Mintfun",
                    value: "mintfun",
                },
                {
                    name: "L2Telegraph",
                    value: "l2telegraph",
                },
                {
                    name: "L2Telegraph Message",
                    value: "l2telegraph_message",
                },
                {
                    name: "Zerius",
                    value: "zerius",
                },
                {
                    name: "Swap all stables to ETH",
                    value: "stable_to_eth",
                },
            ],
            loop: false,
        },
    ]

    const answers = await inquirer.prompt(questions)
    return answers.choice
}