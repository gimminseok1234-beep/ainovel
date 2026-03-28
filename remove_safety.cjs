const fs = require('fs');
let content = fs.readFileSync('./services/geminiService.ts', 'utf8');

// Remove safetySettings from config objects
content = content.replace(/safetySettings:\s*SAFETY_SETTINGS\s*,?/g, '');

// Clean up empty config objects or trailing commas
content = content.replace(/config:\s*\{\s*\}/g, '');
content = content.replace(/,\s*\}/g, ' }');

fs.writeFileSync('./services/geminiService.ts', content);
console.log('Removed safetySettings');
