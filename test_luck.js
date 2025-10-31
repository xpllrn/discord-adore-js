// Simple test script to verify luck system works
const { getService } = require('@services');

async function testLuckSystem() {
  try {
    console.log('Testing luck system...');
    
    const userService = getService('user');
    const testUserId = '123456789'; // Test user ID
    
    // Test getting initial luck
    const initialLuck = await userService.getLuck(testUserId);
    console.log('Initial luck:', initialLuck);
    
    // Test updating luck
    const newLuck = await userService.updateLuck(testUserId, 5);
    console.log('After adding 5 luck:', newLuck);
    
    // Test setting luck directly
    const setLuck = await userService.setLuck(testUserId, 10);
    console.log('After setting to 10:', setLuck);
    
    console.log('✅ Luck system test passed!');
  } catch (error) {
    console.error('❌ Luck system test failed:', error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testLuckSystem();
}

module.exports = { testLuckSystem };