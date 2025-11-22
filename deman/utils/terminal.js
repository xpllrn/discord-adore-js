const axios = require('axios');

class TerminalLogger {
    constructor() {
        this.terminalUrl = process.env.TERMINAL_LOGS_WEBHOOK;
        
        // ANSI color codes for Discord
        this.colors = {
            red: '\u001b[2;31m',
            green: '\u001b[2;32m',
            blue: '\u001b[2;34m',
            yellow: '\u001b[2;33m',
            gray: '\u001b[2;37m',
            reset: '\u001b[0m'
        };
    }

    async log(message, color = null) {
        if (!this.terminalUrl) return;

        try {
            const coloredMessage = color 
                ? `\`\`\`ansi\n${color}${message}${this.colors.reset}\n\`\`\``
                : `\`\`\`\n${message}\n\`\`\``;

            await axios.post(this.terminalUrl, {
                content: coloredMessage
            });
        } catch (error) {
            console.error('[TERMINAL] Failed to send log:', error.message);
        }
    }

    async command(commandName, args, user) {
        const argsText = args.length > 0 ? ` ${args.join(' ')}` : '';
        const message = `[CMD] ${user}: .${commandName}${argsText}`;
        await this.log(message, this.colors.blue);
    }

    async error(errorMessage, context = '') {
        const message = `[ERROR] ${context ? `${context}: ` : ''}${errorMessage}`;
        await this.log(message, this.colors.red);
    }

    async info(infoMessage) {
        const message = `[INFO] ${infoMessage}`;
        await this.log(message, this.colors.gray);
    }

    async warn(warnMessage) {
        const message = `[WARN] ${warnMessage}`;
        await this.log(message, this.colors.yellow);
    }

    async success(successMessage) {
        const message = `[SUCCESS] ${successMessage}`;
        await this.log(message, this.colors.green);
    }
}

module.exports = new TerminalLogger();
