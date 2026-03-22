const fs = require('fs');
let content = fs.readFileSync('./services/geminiService.ts', 'utf8');

const safetyStr = `
const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];
`;

if (!content.includes('SAFETY_SETTINGS')) {
    content = content.replace('export const GEMINI_MODELS', safetyStr + '\nexport const GEMINI_MODELS');
}

// Replace existing safetySettings
content = content.replace(/safetySettings:\s*\[[^\]]+\]/g, 'safetySettings: SAFETY_SETTINGS');
content = content.replace(/safetySettings:\s*isMature\s*\?[^:]+:\s*undefined/g, 'safetySettings: SAFETY_SETTINGS');

function processBlocks(text, methodName) {
    let parts = text.split(methodName + '({');
    for (let i = 1; i < parts.length; i++) {
        let part = parts[i];
        
        // Find the end of the generateContent call
        let endIdx = part.indexOf('});');
        if (endIdx === -1) endIdx = part.indexOf('})');
        
        if (endIdx !== -1) {
            let block = part.substring(0, endIdx);
            
            if (block.includes('config: {')) {
                if (!block.includes('safetySettings:')) {
                    block = block.replace('config: {', 'config: { safetySettings: SAFETY_SETTINGS,');
                }
            } else {
                // Add config block
                block = block + ',\n            config: { safetySettings: SAFETY_SETTINGS }';
            }
            
            parts[i] = block + part.substring(endIdx);
        }
    }
    return parts.join(methodName + '({');
}

content = processBlocks(content, 'ai.models.generateContent');
content = processBlocks(content, 'ai.models.generateContentStream');

fs.writeFileSync('./services/geminiService.ts', content);
console.log('Modified geminiService.ts successfully');
