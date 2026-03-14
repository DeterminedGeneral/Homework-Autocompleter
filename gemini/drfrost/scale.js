function getAxisScales(jsonData) {
    const shapes = jsonData.answer.data.nonanswershapes;
    
    // Default scales (1:1) if nothing is found
    let xScale = 1;
    let yScale = 1;

    // Regex to extract x and y from a point string like "( -3 , 0.5 )"
    // Captures group 1 (x) and group 2 (y)
    const pointRegex = /\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/;

    shapes.forEach(shape => {
        // We only care about shapes that have a numeric Label
        if (shape.showLabel && shape.label && !isNaN(shape.label)) {
            
            const match = shape.latex.match(pointRegex);
            
            if (match) {
                const coordX = parseFloat(match[1]);
                const coordY = parseFloat(match[2]);
                const labelVal = parseFloat(shape.label);

                // LOGIC:
                // If the Label represents an X-axis value, it sits roughly on the Y-axis (y is close to 0)
                // However, Desmos labels are usually offset slightly (e.g., y = -0.05)
                // We check which coordinate is 'significant' compared to the label.

                // Detect X-Axis Label:
                // If the coordinate X is non-zero, and the ratio matches the label direction
                // (We ignore points where x is ~0 because those are likely Y-axis labels)
                if (Math.abs(coordX) > 0.1 && Math.abs(coordY) < 1) { 
                    xScale = labelVal / coordX;
                }

                // Detect Y-Axis Label:
                // If the coordinate Y is non-zero
                // (We ignore points where y is ~0 because those are likely X-axis labels)
                if (Math.abs(coordY) > 0.1 && Math.abs(coordX) < 1) {
                    yScale = labelVal / coordY;
                }
            }
        }
    });

    return {
        xScale: Math.abs(xScale), // Ensure positive
        yScale: Math.abs(yScale)
    };
}


module.exports = getAxisScales;

/*
// --- Usage with your specific JSON ---
const myJson = (require('./question.json'));
console.log(myJson);
const increments = getAxisScales(myJson);

console.log(increments); 
// For your specific data, this will output:
// { xIncrement: 0.1, yIncrement: 0.1 }
*/