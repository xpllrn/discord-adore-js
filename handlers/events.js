const fs = require('fs');
const path = require('path');

/**
 * Event Handler - Loads and registers all events from the events folder
 * @param {Client} client - The Discord.js client instance
 */
module.exports = (client) => {
  const eventsPath = path.join(__dirname, '..', 'events');

  // Check if events directory exists
  if (!fs.existsSync(eventsPath)) {

    fs.mkdirSync(eventsPath, { recursive: true });
    return;
  }

  const eventFolders = fs.readdirSync(eventsPath);
  let eventCount = 0;

  for (const folder of eventFolders) {
    const folderPath = path.join(eventsPath, folder);

    // Skip if not a directory
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const eventFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(folderPath, file);
      const event = require(filePath);

      // Validate event structure
      if (!event.name || typeof event.execute !== 'function') {

        continue;
      }

      // Register the event
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      eventCount++;
    }
  }

  // Store event count on client for startup display
  client.eventCount = eventCount;
};
