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
        this.ownerId = '1439522065656053791';
        this.configPath = path.join(__dirname, 'self.json');
        this.statusConfig = {
            text: null,
            type: 'online',
            avatar: null,
            buttons: []
        };
        
        this.client = new Client({
            checkUpdate: false,
            readyStatus: false,
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
        
        this.loadConfig();
    }

    // Load config from JSON file
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.cleanupEnabled = data.cleanupEnabled || false;
                this.statusConfig = data.statusConfig || this.statusConfig;
                console.log(`[CONFIG] Loaded - Cleanup: ${this.cleanupEnabled ? 'ON' : 'OFF'}`);
            } else {
                this.saveConfig();
            }
        } catch (error) {
            console.error(`[CONFIG] Failed to load: ${error.message}`);
        }
    }

    // Save config to JSON file
    saveConfig() {
        try {
            const data = {
                cleanupEnabled: this.cleanupEnabled,
                statusConfig: this.statusConfig
            };
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`[CONFIG] Failed to save: ${error.message}`);
        }
    }

    // Apply saved status
    applyStatus() {
        if (!this.statusConfig.text) return;

        try {
            const activity = {
                name: this.statusConfig.text,
                type: 'PLAYING'
            };

            if (this.statusConfig.avatar) {
                activity.assets = {
                    large_image: this.statusConfig.avatar
                };
            }

            if (this.statusConfig.buttons.length > 0) {
                activity.buttons = this.statusConfig.buttons;
            }

            this.client.user.setPresence({
                status: this.statusConfig.type,
                activities: [activity]
            });
        } catch (error) {
            console.error('[STATUS] Failed to apply:', error.message);
        }
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
                        if (!command.name) {
                            console.error(`[ERROR] ${item.name} missing 'name' property`);
                            return;
                        }
                        this.commands.set(command.name, command);
                        console.log(`[LOAD] Loaded command: ${command.name}`);
                    } catch (error) {
                        console.error(`[ERROR] Failed to load ${item.name}: ${error.message}`);
                        console.error(error.stack);
                    }
                }
            }
        };

        loadCommandsFromDir(commandsPath);
        console.log(`[INIT] Loaded ${this.commands.size} commands`);
    }

    // Handle commands
    async handleCommand(message) {
        try {
            if (!message?.content?.startsWith(this.prefix)) return;
            if (!message.author || !this.client.user) return;
            
            // Only respond to the owner
            if (message.author.id !== this.ownerId) return;
            
            if (!this.enabled) return;

            const args = message.content.slice(this.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            const command = this.commands.get(commandName);
            if (!command) return;

            console.log(`[CMD] Executing: ${commandName} (from ${message.author.tag})`);
            
            // Delete command message
            await message.delete().catch(() => {});
            await command.execute(message, args, this);
            
            console.log(`[CMD] Completed: ${commandName}`);
        } catch (error) {
            console.error(`[CMD ERROR] ${error.message}`);
            console.error(error.stack);
        }
    }

    // Enable/disable selfbot
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[SELFBOT] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    // Start the selfbot
    async start() {
        return new Promise((resolve, reject) => {
            try {
                console.log('[SELFBOT] Starting initialization...');
                
                if (!this.token) {
                    const error = new Error('TOKEN not found in .env file');
                    console.error('[SELFBOT] ' + error.message);
                    return reject(error);
                }
                console.log('[SELFBOT] Token found');

                // Load commands
                console.log('[SELFBOT] Loading commands...');
                this.loadCommands();

                // Set up event handlers BEFORE login
                console.log('[SELFBOT] Setting up event handlers...');
                
                this.client.once('ready', () => {
                    console.log(`[READY] Logged in as ${this.client.user?.tag || 'Unknown'}`);
                    console.log(`[INFO] Prefix: ${this.prefix}`);
                    console.log(`[INFO] Guilds: ${this.client.guilds?.cache?.size || 0}`);
                    
                    // Apply saved status on startup
                    if (this.statusConfig.text) {
                        this.applyStatus();
                        console.log(`[STATUS] Applied saved status`);
                    }
                    
                    resolve();
                });

                // Message handler
                this.client.on('messageCreate', async (message) => {
                    try {
                        await this.handleCommand(message);
                        
                        // Auto-cleanup messages after 300 seconds
                        if (this.cleanupEnabled && message.author?.id === this.ownerId) {
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
                        console.error(error.stack);
                    }
                });

                // Error handling
                this.client.on('error', (error) => {
                    console.error(`[CLIENT ERROR] ${error.message}`);
                    console.error(error.stack);
                });

                // Login with detailed error catching
                console.log('[SELFBOT] Attempting login...');
                this.client.login(this.token).catch((error) => {
                    console.error(`[LOGIN ERROR] Failed to login`);
                    console.error(`[LOGIN ERROR] Message: ${error.message}`);
                    console.error(`[LOGIN ERROR] Stack: ${error.stack}`);
                    console.error(`[LOGIN ERROR] Full error:`, JSON.stringify(error, null, 2));
                    reject(error);
                });

            } catch (error) {
                console.error(`[FATAL] Failed to start selfbot`);
                console.error(`[FATAL] Error: ${error.message}`);
                console.error(`[FATAL] Stack: ${error.stack}`);
                reject(error);
            }
        });
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
