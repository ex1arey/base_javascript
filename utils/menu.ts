import inquirer from "inquirer"

export const entryPoint = async () => {
    const questions = [
        {
            name: "choice",
            type: "list",
            message: "Действие:",
            choices: [
                {
                    name: "Bridge",
                    value: "bridge",
                },
                {
                    name: "Merkly",
                    value: "merkly",
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
                    name: "Random (mintfun + l2telegraph) $0.05 - $0.40",
                    value: "random",
                },
            ],
            default: "bridge",
            loop: false,
        },
    ]

    const answers = await inquirer.prompt(questions)
    return answers.choice
}