// Store module exports
// This file helps organize store-related commands

module.exports = {
  banknotes: require('./banknotes'),
  items: require('./items')
};

// Store categories available:
// - banknotes: Bank limit increase items
// - items: General consumables and tools
// - Add new store categories here as needed