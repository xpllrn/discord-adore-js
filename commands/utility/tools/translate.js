const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const axios = require('axios');
const { colors, emojis } = require('../../../config/setup');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');

// Language codes mapping for common languages
const languageCodes = {
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'russian': 'ru',
  'japanese': 'ja',
  'korean': 'ko',
  'chinese': 'zh',
  'arabic': 'ar',
  'hindi': 'hi',
  'dutch': 'nl',
  'swedish': 'sv',
  'norwegian': 'no',
  'danish': 'da',
  'finnish': 'fi',
  'polish': 'pl',
  'turkish': 'tr',
  'greek': 'el',
  'hebrew': 'he',
  'thai': 'th',
  'vietnamese': 'vi',
  'indonesian': 'id',
  'malay': 'ms',
  'filipino': 'tl',
  'czech': 'cs',
  'hungarian': 'hu',
  'romanian': 'ro',
  'bulgarian': 'bg',
  'croatian': 'hr',
  'serbian': 'sr',
  'slovak': 'sk',
  'slovenian': 'sl',
  'estonian': 'et',
  'latvian': 'lv',
  'lithuanian': 'lt',
  'ukrainian': 'uk',
  'bengali': 'bn',
  'tamil': 'ta',
  'telugu': 'te',
  'marathi': 'mr',
  'gujarati': 'gu',
  'kannada': 'kn',
  'malayalam': 'ml',
  'punjabi': 'pa',
  'urdu': 'ur',
  'persian': 'fa',
  'swahili': 'sw',
  'afrikaans': 'af'
};

// Language names mapping for display
const languageNames = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'pl': 'Polish',
  'tr': 'Turkish',
  'el': 'Greek',
  'he': 'Hebrew',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'tl': 'Filipino',
  'cs': 'Czech',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sr': 'Serbian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'et': 'Estonian',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'uk': 'Ukrainian',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'pa': 'Punjabi',
  'ur': 'Urdu',
  'fa': 'Persian',
  'sw': 'Swahili',
  'af': 'Afrikaans'
};

async function translateText(text, targetLang = 'en', sourceLang = 'auto') {
  try {
    // Using Google Translate API via translate.googleapis.com
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    if (response.data && response.data[0] && response.data[0][0] && response.data[0][0][0]) {
      const translatedText = response.data[0].map(item => item[0]).join('');
      const detectedLang = response.data[2] || sourceLang;
      
      return {
        success: true,
        translatedText: translatedText,
        sourceLang: detectedLang,
        targetLang: targetLang
      };
    } else {
      return {
        success: false,
        error: 'Invalid response from translation service'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function getLanguageCode(input) {
  if (!input) return 'en';
  
  const lowerInput = input.toLowerCase();
  
  // Check if it's already a language code
  if (languageNames[lowerInput]) {
    return lowerInput;
  }
  
  // Check if it's a language name
  if (languageCodes[lowerInput]) {
    return languageCodes[lowerInput];
  }
  
  // Check partial matches
  for (const [name, code] of Object.entries(languageCodes)) {
    if (name.startsWith(lowerInput) || lowerInput.startsWith(name.substring(0, 3))) {
      return code;
    }
  }
  
  return null;
}

function getLanguageName(code) {
  return languageNames[code] || code.toUpperCase();
}

// Shared logic for translate command
async function handleTranslateShared(context, targetLanguageInput, textToTranslate, repliedMessage) {
  const isInteraction = !!context.user;
  let targetLanguage = 'en';
  let finalText = '';

  // Handle replied message
  if (repliedMessage) {
    if (!repliedMessage.content) {
      return embeds.warn(context, 'The replied message has no text content to translate', false);
    }
    
    finalText = repliedMessage.content;
    
    if (targetLanguageInput) {
      const langCode = getLanguageCode(targetLanguageInput);
      if (langCode) {
        targetLanguage = langCode;
      } else {
        return embeds.warn(context, `Language "${targetLanguageInput}" not recognized. Try languages like: english, spanish, french, german, etc.`, false);
      }
    }
  } else {
    // No reply, use provided text
    if (!textToTranslate || !textToTranslate.trim()) {
      return embeds.warn(context, 'Please provide text to translate', false);
    }
    
    finalText = textToTranslate;
    
    if (targetLanguageInput) {
      const langCode = getLanguageCode(targetLanguageInput);
      if (langCode) {
        targetLanguage = langCode;
      } else {
        return embeds.warn(context, `Language "${targetLanguageInput}" not recognized. Try languages like: english, spanish, french, german, etc.`, false);
      }
    }
  }

  if (finalText.length > 1000) {
    return embeds.warn(context, 'Text is too long to translate (max 1000 characters)', false);
  }

  // Show loading message
  const loadingEmbed = new EmbedBuilder()
    .setColor('#7985cd')
    .setDescription(`${emojis.loading} Translating...`);

  let loadingMessage;
  if (isInteraction) {
    await context.reply({ embeds: [loadingEmbed] });
    loadingMessage = await context.fetchReply();
  } else {
    loadingMessage = await context.channel.send({ embeds: [loadingEmbed] });
  }

  try {
    const result = await translateText(finalText, targetLanguage);

    if (!result.success) {
      const errorEmbed = embeds.createDeny(context, `Translation failed: ${result.error}`);
      if (isInteraction) {
        return context.editReply({ embeds: [errorEmbed] });
      } else {
        await loadingMessage.delete().catch(() => {});
        return context.channel.send({ embeds: [errorEmbed] });
      }
    }

    const sourceLangName = getLanguageName(result.sourceLang);
    const targetLangName = getLanguageName(result.targetLang);
    const user = isInteraction ? context.user : context.author;

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setAuthor({
        name: user.displayName || user.username,
        iconURL: user.displayAvatarURL({ dynamic: true })
      })
      .setTitle(`Translated from ${sourceLangName} to ${targetLangName}`)
      .setDescription(`\`\`\`${result.translatedText}\`\`\``)
      .setFooter({
        text: 'Google Translate',
        iconURL: 'https://cdn.discordapp.com/emojis/1385950785975746684.png'
      });

    if (isInteraction) {
      return context.editReply({ embeds: [embed] });
    } else {
      return loadingMessage.edit({ embeds: [embed] });
    }

  } catch (error) {
    if (isInteraction) {
      const errorEmbed = embeds.createDeny(context, 'An error occurred while translating the text');
      return context.editReply({ embeds: [errorEmbed] });
    } else {
      await loadingMessage.delete().catch(() => {});
      return embeds.deny(context, 'An error occurred while translating the text');
    }
  }
}

module.exports = {
  name: "translate",
  aliases: ['tr'],
  description: "Translate text to different languages",
  syntax: 'translate (language) (text)',
  example: 'translate spanish hello',
  run: async (client, message, args) => {
    let textToTranslate = '';
    let targetLanguageInput = null;
    let repliedMessage = null;

    // Check if this is a reply to a message
    if (message.reference && message.reference.messageId) {
      try {
        repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        targetLanguageInput = args[0] || null;
      } catch (error) {
        return embeds.warn(message, 'Could not fetch the replied message');
      }
    } else {
      // No reply, check args
      if (!args[0]) {
        return runHelpCommand(message, 'translate');
      }

      // Check if first arg is a language
      const possibleLangCode = getLanguageCode(args[0]);

      if (possibleLangCode && args.length === 1) {
        // Only language provided, no text
        return embeds.warn(message, 'Please provide text to translate or reply to a message');
      } else if (possibleLangCode && args.length > 1) {
        // Language + text provided
        targetLanguageInput = args[0];
        textToTranslate = args.slice(1).join(' ');
      } else {
        // No language, just text (translate to English)
        textToTranslate = args.join(' ');
      }
    }

    return await handleTranslateShared(message, targetLanguageInput, textToTranslate, repliedMessage);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text to different languages')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('The text to translate')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addStringOption(option =>
      option
        .setName('language')
        .setDescription('Target language (default: English)')
        .setRequired(false)
        .addChoices(
          { name: 'English', value: 'en' },
          { name: 'Spanish', value: 'es' },
          { name: 'French', value: 'fr' },
          { name: 'German', value: 'de' },
          { name: 'Italian', value: 'it' },
          { name: 'Portuguese', value: 'pt' },
          { name: 'Russian', value: 'ru' },
          { name: 'Japanese', value: 'ja' },
          { name: 'Korean', value: 'ko' },
          { name: 'Chinese', value: 'zh' },
          { name: 'Arabic', value: 'ar' },
          { name: 'Hindi', value: 'hi' },
          { name: 'Dutch', value: 'nl' },
          { name: 'Swedish', value: 'sv' },
          { name: 'Turkish', value: 'tr' },
          { name: 'Polish', value: 'pl' },
          { name: 'Greek', value: 'el' },
          { name: 'Thai', value: 'th' },
          { name: 'Vietnamese', value: 'vi' },
          { name: 'Indonesian', value: 'id' },
          { name: 'Filipino', value: 'tl' },
          { name: 'Czech', value: 'cs' },
          { name: 'Hungarian', value: 'hu' },
          { name: 'Romanian', value: 'ro' },
          { name: 'Ukrainian', value: 'uk' }
        )
    ),

  async execute(interaction) {
    const text = interaction.options.getString('text');
    const targetLanguage = interaction.options.getString('language');

    return await handleTranslateShared(interaction, targetLanguage, text, null);
  }
};
