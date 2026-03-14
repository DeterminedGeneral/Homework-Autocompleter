function convertAItoObject(str) {
    // Check if the string is exactly "No model"
    if (str === "No Models" || !str) {
        return { 0: "", 1: "", 2: "" };
    }

    const parts = str.split(' -> ');

    return {
        0: parts[0] ?? "",
        1: parts[1] ?? "",
        2: parts[2] ?? ""
    };
}

module.exports = convertAItoObject;