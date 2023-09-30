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
                    name: "Mintfun",
                    value: "mintfun",
                },
            ],
            default: "bridge",
            loop: false,
        },
    ]

    const answers = await inquirer.prompt(questions)
    return answers.choice
}