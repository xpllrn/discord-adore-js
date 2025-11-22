const fs = require('fs');
const path = require('path');

// Clean and extract ren's messages from dump.txt
function cleanDataset() {
    const dumpPath = path.join(__dirname, '../context/dump.txt');
    const dump = fs.readFileSync(dumpPath, 'utf8');
    
    const lines = dump.split('\n');
    const renMessages = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Extract ren's messages
        if (line.startsWith('ren —') || line.startsWith('ren—')) {
            const nextLine = lines[i + 1]?.trim();
            if (nextLine && !nextLine.includes('—')) {
                // Skip bot commands
                if (nextLine.startsWith(',') || nextLine.startsWith('.') || nextLine.startsWith('!')) {
                    continue;
                }
                
                // Clean the message
                const cleaned = nextLine
                    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // remove emojis
                    .replace(/\s+/g, ' ')
                    .trim();
                
                if (cleaned.length > 0 && cleaned.length < 100) {
                    renMessages.push(cleaned);
                }
            }
        }
    }
    
    return renMessages;
}

// Analyze ren's style patterns
function analyzeStyle(messages) {
    const patterns = {
        slang: {},
        avgLength: 0,
        lowercase: 0,
        questions: 0,
        singleWords: 0
    };
    
    const slangWords = ['ion', 'u', 'wtv', 'oml', 'bruh', 'nvm', 'wym', 'alr', 'lmfao', 'hruu'];
    
    messages.forEach(msg => {
        patterns.avgLength += msg.split(' ').length;
        if (msg === msg.toLowerCase()) patterns.lowercase++;
        if (msg.includes('?')) patterns.questions++;
        if (msg.split(' ').length === 1) patterns.singleWords++;
        
        slangWords.forEach(slang => {
            if (msg.toLowerCase().includes(slang)) {
                patterns.slang[slang] = (patterns.slang[slang] || 0) + 1;
            }
        });
    });
    
    patterns.avgLength = Math.round(patterns.avgLength / messages.length);
    patterns.lowercasePercent = Math.round((patterns.lowercase / messages.length) * 100);
    patterns.questionPercent = Math.round((patterns.questions / messages.length) * 100);
    patterns.singleWordPercent = Math.round((patterns.singleWords / messages.length) * 100);
    
    return patterns;
}

// Generate personality.json
function generatePersonality() {
    console.log('[CLEANER] Extracting ren messages...');
    const messages = cleanDataset();
    console.log(`[CLEANER] Extracted ${messages.length} messages`);
    
    console.log('[CLEANER] Analyzing style patterns...');
    const patterns = analyzeStyle(messages);
    
    const personality = {
        style: {
            avgWordCount: patterns.avgLength,
            lowercasePercent: patterns.lowercasePercent,
            questionPercent: patterns.questionPercent,
            singleWordPercent: patterns.singleWordPercent
        },
        slang: patterns.slang,
        examples: messages.slice(0, 50), // Top 50 clean examples
        rules: [
            `Average ${patterns.avgLength} words per message`,
            `${patterns.lowercasePercent}% lowercase`,
            `${patterns.singleWordPercent}% single-word responses`,
            'No emoji spam',
            'Direct and chill tone'
        ]
    };
    
    const outputPath = path.join(__dirname, '../context/personality.json');
    fs.writeFileSync(outputPath, JSON.stringify(personality, null, 2));
    
    console.log('[CLEANER] Generated personality.json');
    console.log(`[CLEANER] Style: ${patterns.avgLength} words avg, ${patterns.lowercasePercent}% lowercase`);
    console.log(`[CLEANER] Top slang:`, Object.entries(patterns.slang).sort((a, b) => b[1] - a[1]).slice(0, 5));
}

if (require.main === module) {
    generatePersonality();
}

module.exports = { cleanDataset, analyzeStyle, generatePersonality };
