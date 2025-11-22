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
            subtext: null,
            type: 'online',
            avatar: null,
            subavatar: null,
            buttons: [],
            activityType: 'PLAYING',
            enabled: false
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
        this.responderEnabled = [];
        this.customStatus = null;
        this.statusLoop = {
            enabled: false,
            lines: [],
            currentIndex: 0
        };
        this.statusLoopInterval = null;
        
        this.loadConfig();
    }

    // Load config from JSON file
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.cleanupEnabled = data.cleanupEnabled || false;
                this.statusConfig = data.statusConfig || this.statusConfig;
                this.responderEnabled = data.responderEnabled || [];
                this.customStatus = data.customStatus || null;
                this.statusLoop = data.statusLoop || this.statusLoop;
                console.log(`[CONFIG] Loaded - Cleanup: ${this.cleanupEnabled ? 'ON' : 'OFF'}, Responder: ${this.responderEnabled.length} users`);
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
                statusConfig: this.statusConfig,
                responderEnabled: this.responderEnabled,
                customStatus: this.customStatus,
                statusLoop: this.statusLoop
            };
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
            console.log(`[CONFIG] Saved - Status: ${this.statusConfig.text || 'none'}, Buttons: ${this.statusConfig.buttons.length}`);
        } catch (error) {
            console.error(`[CONFIG] Failed to save: ${error.message}`);
        }
    }

    // Apply saved status
    applyStatus() {
        if (!this.statusConfig.enabled) return;
        if (!this.statusConfig.text && !this.statusConfig.avatar && this.statusConfig.buttons.length === 0) {
            return;
        }

        try {
            const { RichPresence } = require('discord.js-selfbot-v13');
            
            const statusText = this.statusConfig.text || 'Custom Activity';
            
            const rpc = new RichPresence(this.client)
                .setApplicationId('1234567890')
                .setType(this.statusConfig.activityType || 'PLAYING')
                .setName(statusText);

            if (this.statusConfig.subtext) {
                rpc.setState(this.statusConfig.subtext);
            }
            
            if (this.statusConfig.subtext) {
                rpc.setDetails(this.statusConfig.subtext);
            }

            if (this.statusConfig.avatar) {
                rpc.setAssetsLargeImage(this.statusConfig.avatar);
            }

            if (this.statusConfig.subavatar) {
                rpc.setAssetsSmallImage(this.statusConfig.subavatar);
            }

            // Buttons - try both methods
            if (this.statusConfig.buttons.length > 0) {
                console.log('[ACTIVITY] Adding buttons:', JSON.stringify(this.statusConfig.buttons));
                
                // Method 1: Try addButton
                try {
                    this.statusConfig.buttons.forEach((btn, index) => {
                        if (btn.label && btn.url) {
                            console.log(`[ACTIVITY] Adding button ${index + 1}: ${btn.label} -> ${btn.url}`);
                            rpc.addButton(btn.label, btn.url);
                        }
                    });
                } catch (error) {
                    console.error('[ACTIVITY] Button error:', error.message);
                }
                
                // Method 2: Try setURL for first button (works with STREAMING type)
                if (this.statusConfig.activityType === 'STREAMING' && this.statusConfig.buttons[0]) {
                    try {
                        rpc.setURL(this.statusConfig.buttons[0].url);
                        console.log('[ACTIVITY] Set streaming URL:', this.statusConfig.buttons[0].url);
                    } catch (error) {
                        console.error('[ACTIVITY] setURL error:', error.message);
                    }
                }
            }

            const activities = [];
            
            // Add custom status FIRST if set
            if (this.customStatus) {
                const { CustomStatus } = require('discord.js-selfbot-v13');
                const customStatus = new CustomStatus(this.client)
                    .setState(this.customStatus);
                activities.push(customStatus);
                console.log(`[ACTIVITY] Adding custom status: ${this.customStatus}`);
            }
            
            // Add rich presence
            activities.push(rpc);
            
            console.log(`[ACTIVITY] Setting presence with ${activities.length} activities`);
            
            this.client.user.setPresence({
                status: this.statusConfig.type,
                activities: activities
            });
            
            console.log(`[ACTIVITY] Applied: ${statusText} (${this.statusConfig.activityType}) with ${this.statusConfig.buttons.length} button(s)`);
        } catch (error) {
            console.error('[ACTIVITY] Failed to apply:', error.message);
            console.error(error.stack);
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
        let commandName = 'Unknown';
        try {
            if (!message?.content?.startsWith(this.prefix)) return;
            if (!message.author || !this.client.user) return;
            
            // Only respond to the owner
            if (message.author.id !== this.ownerId) return;
            
            if (!this.enabled) return;

            const args = message.content.slice(this.prefix.length).trim().split(/ +/);
            commandName = args.shift().toLowerCase();

            const command = this.commands.get(commandName);
            if (!command) return;

            console.log(`[CMD] Executing: ${commandName} (from ${message.author.tag})`);
            
            // Log to terminal webhook
            const terminal = require('./utils/terminal');
            await terminal.command(commandName, args, message.author.tag);
            
            // Delete command message
            await message.delete().catch(() => {});
            await command.execute(message, args, this);
            
            console.log(`[CMD] Completed: ${commandName}`);
        } catch (error) {
            console.error(`[CMD ERROR] ${error.message}`);
            console.error(error.stack);
            
            // Log error to terminal webhook
            const terminal = require('./utils/terminal');
            await terminal.error(error.message, commandName).catch(() => {});
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
                
                this.client.once('ready', async () => {
                    console.log(`[READY] Logged in as ${this.client.user?.tag || 'Unknown'}`);
                    console.log(`[INFO] Prefix: ${this.prefix}`);
                    console.log(`[INFO] Guilds: ${this.client.guilds?.cache?.size || 0}`);
                    
                    // Log to terminal
                    const terminal = require('./utils/terminal');
                    await terminal.success(`Selfbot ready: ${this.client.user?.tag || 'Unknown'}`);
                    await terminal.info(`Prefix: ${this.prefix} | Guilds: ${this.client.guilds?.cache?.size || 0}`);
                    
                    // Apply saved status on startup
                    if (this.statusConfig.enabled && this.statusConfig.text) {
                        this.applyStatus();
                        console.log(`[ACTIVITY] Applied saved activity`);
                    }
                    
                    resolve();
                });

                // Message handler
                this.client.on('messageCreate', async (message) => {
                    try {
                        await this.handleCommand(message);
                        
                        // Auto-responder for enabled users
                        if (message.author?.id !== this.ownerId) {
                            const responder = require('./utils/responder');
                            await responder.handleMessage(message, this);
                        }
                        
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
                        
                        // Log to terminal webhook
                        const terminal = require('./utils/terminal');
                        await terminal.error(error.message, 'Message Handler').catch(() => {});
                    }
                });

                // Message delete handler
                this.client.on('messageDelete', async (message) => {
                    try {
                        // Only log messages from OTHER people (not the owner)
                        if (message.author?.id === this.ownerId) return;
                        
                        // Only log DM messages
                        if (message.channel?.type !== 'DM') return;
                        
                        const webhook = require('./utils/webhook');
                        await webhook.sendDeletedMessage({
                            author: message.author,
                            content: message.content || '*No content*',
                            deletedAt: new Date()
                        });
                    } catch (error) {
                        console.error(`[DELETE ERROR] ${error.message}`);
                    }
                });

                // Message edit handler
                this.client.on('messageUpdate', async (oldMessage, newMessage) => {
                    try {
                        // Only log messages from OTHER people (not the owner)
                        if (newMessage.author?.id === this.ownerId) return;
                        
                        // Only log DM messages
                        if (newMessage.channel?.type !== 'DM') return;
                        
                        // Ignore if content didn't change
                        if (oldMessage.content === newMessage.content) return;
                        
                        const webhook = require('./utils/webhook');
                        await webhook.sendEditedMessage({
                            author: newMessage.author,
                            oldContent: oldMessage.content || '*No content*',
                            newContent: newMessage.content || '*No content*',
                            editedAt: new Date()
                        });
                    } catch (error) {
                        console.error(`[EDIT ERROR] ${error.message}`);
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
