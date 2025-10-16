// User update handler for tracking username and displayname changes

module.exports = {
  name: 'userUpdate',
  async execute(oldUser, newUser) {
    try {
      // Skip if no actual changes
      if (oldUser.username === newUser.username && oldUser.displayName === newUser.displayName) {
        return;
      }

      const userCache = require('../../database/cache/models/user');
      const { ensureUserData } = require('../../database');

      // Ensure user data exists
      await ensureUserData(newUser.id);

      // Track username changes
      if (oldUser.username !== newUser.username) {
        await userCache.addNameChange(
          newUser.id,
          'username',
          oldUser.username,
          newUser.username,
          null // Global change, no guild ID
        );
      }

      // Track displayname changes
      if (oldUser.displayName !== newUser.displayName) {
        await userCache.addNameChange(
          newUser.id,
          'displayname',
          oldUser.displayName || oldUser.username,
          newUser.displayName || newUser.username,
          null // Global change, no guild ID
        );
      }

    } catch (error) {
      // Silent fail for name tracking
      console.error('Error tracking user name change:', error);
    }
  }
}
