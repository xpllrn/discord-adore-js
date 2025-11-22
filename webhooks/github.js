const express = require('express');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');

class GitHubWebhook {
  constructor(client) {
    this.client = client;
    this.app = express();
    this.port = process.env.GITHUB_WEBHOOK_PORT || 3000;
    this.secret = process.env.GITHUB_WEBHOOK_SECRET;
    this.channelId = process.env.GITHUB_WEBHOOK_CHANNEL_ID;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
      }
    }));
  }

  verifySignature(req) {
    if (!this.secret) return true;
    
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    this.app.post('/github', async (req, res) => {
      try {
        if (!this.verifySignature(req)) {
          return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = req.headers['x-github-event'];
        
        if (event === 'push') {
          await this.handlePush(req.body);
        }

        res.status(200).json({ received: true });
      } catch (error) {
        console.error('GitHub webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  async handlePush(payload) {
    const { repository, commits, ref, compare, sender } = payload;
    const branch = ref.replace('refs/heads/', '');
    
    // Count file changes
    let filesAdded = 0;
    let filesModified = 0;
    let filesRemoved = 0;
    
    commits.forEach(commit => {
      filesAdded += commit.added?.length || 0;
      filesModified += commit.modified?.length || 0;
      filesRemoved += commit.removed?.length || 0;
    });
    
    // Build file changes text
    let fileChanges = [];
    if (filesModified > 0) fileChanges.push(`Modified ${filesModified} file${filesModified > 1 ? 's' : ''}`);
    if (filesAdded > 0) fileChanges.push(`Added ${filesAdded} file${filesAdded > 1 ? 's' : ''}`);
    if (filesRemoved > 0) fileChanges.push(`Removed ${filesRemoved} file${filesRemoved > 1 ? 's' : ''}`);
    
    // Get the latest commit message
    const latestCommit = commits[commits.length - 1];
    const commitMessage = latestCommit?.message?.split('\n')[0] || 'No commit message';
    
    // Build description
    let description = `> There had been **${commits.length}** commit${commits.length > 1 ? 's' : ''} to \`${repository.full_name}\`\n`;
    if (fileChanges.length > 0) {
      description += `\`\`\`ansi\n\u001b[0;32m${fileChanges.join(', ')}\u001b[0m\n\`\`\``;
    }
    description += `\`\`\`${commitMessage}\`\`\``;
    
    const embed = new EmbedBuilder()
      .setColor('#242429')
      .setAuthor({ 
        name: sender.login, 
        iconURL: sender.avatar_url,
        url: sender.html_url
      })
      .setTitle(`Commit to ${repository.name} (${branch})`)
      .setURL(compare)
      .setDescription(description)
      .setTimestamp();

    await this.sendToChannel(embed);
  }

  async sendToChannel(embed) {
    if (!this.channelId) {
      console.warn('⚠️  No GITHUB_WEBHOOK_CHANNEL_ID configured');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('❌ Failed to send GitHub webhook:', error.message);
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
          console.log(`✅ GitHub webhook server running on port ${this.port}`);
          console.log(`   Endpoint: http://0.0.0.0:${this.port}/github`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 GitHub webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = GitHubWebhook;
