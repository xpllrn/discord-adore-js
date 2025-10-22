const fetch = require('node-fetch');
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const config = require('../../config/setup');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "ask",
  description: `AI-powered command dispatcher - ask in natural language and I'll run the right command`,
  usage: `{guildprefix}ask [natural language request]
{guildprefix}ask remind me to water plants in 4 hours
{guildprefix}ask ban this user @user
{guildprefix}ask show my past names`,


  run: async (client, message, args) => {

    // Check if Deep Infra API key is configured
    if (!config.apis.deepinfra) {
      return embeds.warn(message, 'Deep Infra API key is not configured.');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'ask');
    }

    const userRequest = args.join(' ');

    // Load command reference
    const commandReference = loadCommandReference();
    if (!commandReference) {
      return embeds.warn(message, 'Command reference not available. Please contact an administrator.');
    }

    // Create AI prompt for command dispatching
    const systemPrompt = createCommandDispatcherPrompt(commandReference);
    const userPrompt = `User request: "${userRequest}"

Context:
- User: ${message.author.tag} (ID: ${message.author.id})
- Guild: ${message.guild.name} (ID: ${message.guild.id})
- Channel: ${message.channel.name}
- User has access to all commands

Analyze this request and determine the best command to execute. Respond with ONLY the command and arguments in this exact format:
COMMAND: [command_name] [arguments]

If no suitable command exists, respond with:
RESPONSE: [your helpful response]`;

    try {
      // Make API request to Deep Infra
      const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apis.deepinfra}`
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-7-sonnet-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 150,
          temperature: 0.1 // Low temperature for consistent command parsing
        }),
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }

      const aiResponse = data.choices[0].message.content.trim();

      // Parse AI response
      if (aiResponse.startsWith('COMMAND:')) {
        const commandLine = aiResponse.substring(8).trim();
        console.log(`AI Command Dispatcher: "${userRequest}" → "${commandLine}"`);
        await executeCommand(client, message, commandLine);
      } else if (aiResponse.startsWith('RESPONSE:')) {
        const responseText = aiResponse.substring(9).trim();
        await message.reply(responseText);
      } else {
        // Fallback - treat as direct response
        await message.reply(aiResponse);
      }

    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Ask Command', {
          command: 'ask',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      return embeds.warn(message, 'Failed to process your request. Please try again later.');
    }
  }
};

// Load command reference from JSON file
function loadCommandReference() {
  try {
    const commandRefPath = path.join(__dirname, '../../cmdlist/cmddoc.json');
    if (!fs.existsSync(commandRefPath)) {
      // File not found - return null silently
      return null;
    }

    const rawData = fs.readFileSync(commandRefPath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    // Return null silently for file loading errors
    return null;
  }
}

// Create system prompt for command dispatching
function createCommandDispatcherPrompt(commands) {
  const commandList = commands.map(cmd => {
    const aliases = cmd.aliases && cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
    const permission = cmd.permission ? ` [${cmd.permission} required]` : '';
    const usage = cmd.usage ? `\n  Usage: ${cmd.usage.replace(/\\n/g, '\n         ')}` : '';
    return `• ${cmd.name}${aliases}: ${cmd.description}${permission}${usage}`;
  }).join('\n\n');

  return `You are an intelligent command dispatcher for a Discord bot. Your job is to analyze user requests in natural language and determine which bot command should be executed with the correct syntax.

Available Commands:
${commandList}

CRITICAL PARSING RULES:
1. Study the exact usage patterns shown for each command
2. Match user intent to the most appropriate command
3. Extract arguments in the EXACT order and format specified in the usage examples
4. Preserve Discord mentions (<#channelid>, <@userid>, <@&roleid>) exactly as they appear
5. For commands with subcommands, follow the exact syntax: [command] [subcommand] [args]
6. For time expressions: 4 hours = 4h, 30 minutes = 30m, 2 days = 2d
7. For moderation commands, ensure clear intent to moderate
8. If syntax is unclear, prefer the first usage example shown

COMMAND SYNTAX EXAMPLES:
- "set a leave message in <#1234> with message hello" → COMMAND: leave add <#1234> hello
- "add automod word badword" → COMMAND: automod add badword
- "enable invite filtering" → COMMAND: automod invites enable
- "ignore <#1234> for automod" → COMMAND: automod ignore <#1234>
- "remind me in 4 hours to do something" → COMMAND: remind 4h do something
- "ban @user123 for spam" → COMMAND: ban @user123 for spam
- "show my balance" → COMMAND: bal
- "create role called Moderator" → COMMAND: role create Moderator
- "give @user the Admin role" → COMMAND: role @user Admin

IMPORTANT: Always follow the exact command structure shown in the usage examples. Pay special attention to:
- Order of arguments (channel first, then message for leave/welcome commands)
- Subcommand placement (automod invites enable, not automod enable invites)
- Proper Discord mention formatting
- Required vs optional parameters

Always respond with either "COMMAND: [command] [args]" or "RESPONSE: [helpful message]".`;
}

// Execute the determined command
async function executeCommand(client, message, commandLine) {
  try {
    // Better argument parsing that preserves Discord mentions and quoted strings
    const args = parseCommandArgs(commandLine);
    const commandName = args.shift().toLowerCase();

    console.log(`AI Command Dispatcher: Executing "${commandName}" with args:`, args);

    // Find the command
    const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));

    if (!command) {
      return embeds.warn(message, `Command "${commandName}" not found. The AI might have made an error.`);
    }

    // Execute the command directly with the original message object
    // This preserves all Discord.js functionality and references
    if (command.run) {
      await command.run(client, message, args);
    } else if (command.execute) {
      await command.execute(message, args, client);
    } else {
      return embeds.warn(message, `Command "${commandName}" has no execution method.`);
    }

    await message.react('<:success:1379289220606070834>').catch(() => {});

  } catch (error) {
    // Send error to webhook instead of console
    if (message.client?.errorLogger) {
      message.client.errorLogger.log(error, 'Ask Command Dispatch', {
        command: `ask -> ${commandName}`,
        args: args.join(' ') || '',
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
    return embeds.warn(message, 'Failed to execute the command. Please try running it manually.');
  }
}

// Enhanced argument parsing function
function parseCommandArgs(commandLine) {
  const args = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        args.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}