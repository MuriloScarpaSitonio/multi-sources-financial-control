export default function getChoiceByLabel(label, choices) {
    for (const choice of choices) {
        if (choice.label === label) return choice
    }
}
