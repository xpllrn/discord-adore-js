// Store module exports
// This file helps organize store-related commands
// Prefixed with _ to prevent command loader from trying to load it

module.exports = {
  items: require('./items')
};

// Store categories available (all managed through items.js command):
// - banknotes: Bank limit increase items
// - items: General consumables and tools (e.g., Padlock)
// - rings: Marriage rings
// All items are defined in database/services/features/StoreService.js