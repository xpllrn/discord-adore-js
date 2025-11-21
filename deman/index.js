const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class SelfBot {
    constructor(config = {}) {
        this.token = process.env.TOKEN;
        this.prefix = '.';
        this.commands = new Map();
        this.cleanupEnabled = false;
        this.cleanupInterval = null;
        this.spamIntervals = new Map();
        this.enabled = true;
        
        this.client = new Client({
            checkUpdate: false,
            ws: {
                properties: {
                    browser: 'Discord Client',
                    os: 'Windows',
                    device: 'desktop'
                }
            }
        });

        this.humanDelay = { min: 800, max: 2500 };
        this.typingSpeed = { min: 50, max: 150 };
    }

    // Humanized delay
    async sleep(min = this.humanDelay.min, max = this.humanDelay.max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    // Load commands from commands folder (with subfolders)
    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            console.log('[INIT] Created commands folder');
            return;
        }

        const loadCommandsFromDir = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    loadCommandsFromDir(fullPath);
                } else if (item.name.endsWith('.js')) {
                    try {
                        const command = require(fullPath);
                        this.commands.set(command.name, command);
                        console.log(`[LOAD] Loaded command: ${command.name}`);
                    } catch (error) {
                        console.error(`[ERROR] Failed to load ${item.name}: ${error.message}`);
                    }
                }
            }
        };

        loadCommandsFromDir(commandsPath);
        console.log(`[INIT] Loaded ${this.commands.size} commands`);
    }

    // Handle commands
    async handleCommand(message) {
        if (!message?.content?.startsWith(this.prefix)) return;
        if (!message.author || !this.client.user) return;
        if (message.author.id !== this.client.user.id) return;
        if (!this.enabled) return;

        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = this.commands.get(commandName);
        if (!command) return;

        try {
            // Delete command message
            await message.delete().catch(() => {});
            await command.execute(message, args, this);
        } catch (error) {
            console.error(`[ERROR] Command ${commandName} failed: ${error.message}`);
        }
    }

    // Enable/disable selfbot
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[SELFBOT] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    // Start the selfbot
    async start() {
        try {
            if (!this.token) {
                throw new Error('TOKEN not found in .env file');
            }

            // Load commands
            this.loadCommands();

            // Set up event handlers BEFORE login
            this.client.once('ready', () => {
                console.log(`[READY] Logged in as ${this.client.user?.tag || 'Unknown'}`);
                console.log(`[INFO] Prefix: ${this.prefix}`);
                console.log(`[INFO] Guilds: ${this.client.guilds?.cache?.size || 0}`);
            });

            // Message handler
            this.client.on('messageCreate', async (message) => {
                try {
                    await this.handleCommand(message);
                    
                    // Auto-cleanup messages after 300 seconds
                    if (this.cleanupEnabled && message.author?.id === this.client.user?.id) {
                        setTimeout(async () => {
                            try {
                                await message.delete();
                            } catch (error) {
                                // Message already deleted or no permission
                            }
                        }, 300000);
                    }
                } catch (error) {
                    console.error(`[MESSAGE ERROR] ${error.message}`);
                }
            });

            // Error handling
            this.client.on('error', (error) => {
                console.error(`[CLIENT ERROR] ${error.message}`);
            });

            // Login
            await this.client.login(this.token);

        } catch (error) {
            console.error(`[FATAL] Failed to start: ${error.message}`);
            throw error;
        }
    }

    // Stop the selfbot
    async stop() {
        await this.client.destroy();
        console.log('[STOP] Selfbot stopped');
    }
}

// Start if run directly
if (require.main === module) {
    const bot = new SelfBot();
    bot.start();
}

module.exports = SelfBot;
