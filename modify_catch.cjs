const fs = require('fs');
let content = fs.readFileSync('./services/geminiService.ts', 'utf8');

const errorHandler = `
let lastErrorTime = 0;
export const handleApiError = (e: any) => {
    const msg = e?.message || String(e);
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('forbidden') || msg.includes('Forbidden')) {
        const now = Date.now();
        if (now - lastErrorTime > 5000) {
            lastErrorTime = now;
            alert(\`API 접근 권한 오류(403)가 발생했습니다.\\n\\n[안내사항]\\n1. 입력하신 API 키가 유효한지 확인해주세요.\\n2. 해당 API 키에 필요한 권한이 부여되어 있는지 확인해주세요.\\n3. 무료 할당량을 초과했거나 결제 정보가 필요한 상태일 수 있습니다.\\n4. 특정 국가/지역에서는 API 접근이 제한될 수 있습니다.\\n\\n상세 오류: \${msg}\`);
        }
    }
};
`;

if (!content.includes('handleApiError')) {
    content = content.replace('export const GEMINI_MODELS', errorHandler + '\nexport const GEMINI_MODELS');
}

// Replace catch (e) { with catch (e) { handleApiError(e);
content = content.replace(/catch\s*\(\s*e\s*(:\s*any)?\s*\)\s*\{/g, (match) => {
    return match + ' handleApiError(e); ';
});

// Replace catch(fallbackError) { with catch(fallbackError) { handleApiError(fallbackError);
content = content.replace(/catch\s*\(\s*fallbackError\s*\)\s*\{/g, (match) => {
    return match + ' handleApiError(fallbackError); ';
});

fs.writeFileSync('./services/geminiService.ts', content);
console.log('Modified geminiService.ts catch blocks');
