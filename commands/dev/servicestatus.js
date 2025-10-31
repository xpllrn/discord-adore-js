const { embeds } = require('../../core/embeds');

module.exports = {
  name: "servicestatus",
  aliases: ['services'],
  description: 'Check the status of all services',
  syntax: 'servicestatus',
  permission: 'dev',
  run: async (client, message, args) => {
    
    try {
      const { getServiceHealth, getService } = require('@services');
      
      let report = '**Service Status Report:**\n\n';
      
      // Get overall health
      const health = getServiceHealth();
      
      report += `**Overall Status:** ${health.overall ? '✅ Healthy' : '❌ Unhealthy'}\n`;
      report += `**Connection Manager:** ${health.connectionManager ? '✅' : '❌'}\n\n`;
      
      // Check individual services
      const services = ['guild', 'user', 'store', 'spotify', 'moderation', 'webhook', 'welcomeButton', 'system', 'prefix'];
      
      for (const serviceName of services) {
        try {
          const service = getService(serviceName);
          const status = service ? '✅ Available' : '❌ Not Available';
          const initialized = service?.initialized ? '✅' : '❌';
          report += `**${serviceName}:** ${status} (Init: ${initialized})\n`;
        } catch (error) {
          report += `**${serviceName}:** ❌ Error - ${error.message}\n`;
        }
      }
      
      // Add health details
      report += `\n**Health Details:**\n`;
      Object.entries(health).forEach(([key, value]) => {
        if (key !== 'overall') {
          report += `- ${key}: ${value ? '✅' : '❌'}\n`;
        }
      });
      
      return embeds.success(message, report);
      
    } catch (error) {
      console.error('Error checking service status:', error);
      return embeds.deny(message, `Failed to check service status: ${error.message}`);
    }
  }
};