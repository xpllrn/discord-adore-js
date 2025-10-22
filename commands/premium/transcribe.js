const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = {
  name: 'ts',
  description: 'Transcribe voice messages to text using AI',
  usage: `{guildprefix}ts (reply to a voice note)`,


  run: async (client, message) => {
    if (!config.apis.deepinfra) {
      return embeds.warn(message, 'Deep Infra API key is not configured.');
    }

    // Must be a reply to a message
    if (!message.reference) {
      return embeds.warn(message, 'Reply to a voice note to transcribe it.');
    }

    try {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
      const voiceAttachment = repliedMsg?.attachments.find(att => att.contentType?.startsWith('audio/'));

      if (!voiceAttachment) {
        return embeds.warn(message, 'No audio attachment found in the replied message.');
      }

      // Fetch audio as buffer
      const audioRes = await fetch(voiceAttachment.url);
      const audioBuffer = await audioRes.buffer();

      const form = new FormData();
      form.append('audio', audioBuffer, { filename: 'voice.ogg' });
      form.append('model', 'openai/whisper-large-v3-turbo');
      form.append('language', 'en');

      const response = await fetch('https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apis.deepinfra}`,
          ...form.getHeaders()
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const segments = result?.segments || [];
      const transcribedText = segments.map(seg => seg.text).join(' ').trim();

      if (!transcribedText) {
        return embeds.warn(message, 'no, leave me alone');
      }

      await message.reply({ content: `${transcribedText}` });

    } catch (error) {
      console.error('Transcription failed:', error);
      return embeds.warn(message, 'Failed to transcribe the voice message. Try again later.');
    }
  }
};