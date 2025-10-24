// User update handler for tracking username and displayname changes

module.exports = {
  name: 'userUpdate',
  async execute(oldUser, newUser) {
    try {
      // Skip if no actual changes
      if (oldUser.username === newUser.username && oldUser.displayName === newUser.displayName) {
        return;
      }

      const { getService } = require('@services');
      const userService = getService('user');

      // Track username changes using service layer
      if (oldUser.username !== newUser.username) {
        await userService.addNameChange(
          newUser.id,
          'username',
          oldUser.username,
          newUser.username,
          null // Global change, no guild ID
        );
      }

      // Track displayname changes using service layer
      if (oldUser.displayName !== newUser.displayName) {
        await userService.addNameChange(
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
