// Shared store items configuration
const STORE_ITEMS = {
  'banknote_dirt': {
    id: '1',
    name: 'Dirt Banknote',
    description: 'Increases your bank limit by 20,000 coins',
    price: 20000,
    emoji: '🌱',
    category: 'banknotes',
    bankLimitIncrease: 20000,
    sellPrice: 10000,
    stackable: true
  },
  'banknote_commoner': {
    id: '2',
    name: 'Commoner Banknote',
    description: 'Increases your bank limit by 50,000 coins',
    price: 45000,
    emoji: '🪙',
    category: 'banknotes',
    bankLimitIncrease: 50000,
    sellPrice: 22500,
    stackable: true
  },
  'banknote_regular': {
    id: '3',
    name: 'Regular Banknote',
    description: 'Increases your bank limit by 100,000 coins',
    price: 90000,
    emoji: '💵',
    category: 'banknotes',
    bankLimitIncrease: 100000,
    sellPrice: 45000,
    stackable: true
  },
  'banknote_noble': {
    id: '4',
    name: 'Noble Banknote',
    description: 'Increases your bank limit by 500,000 coins',
    price: 400000,
    emoji: '👑',
    category: 'banknotes',
    bankLimitIncrease: 500000,
    sellPrice: 200000,
    stackable: true
  },
  'banknote_royal': {
    id: '5',
    name: 'Royal Banknote',
    description: 'Increases your bank limit by 1,000,000 coins',
    price: 800000,
    emoji: '💎',
    category: 'banknotes',
    bankLimitIncrease: 1000000,
    sellPrice: 400000,
    stackable: true
  },
  'banknote_mythical': {
    id: '6',
    name: 'Mythical Banknote',
    description: 'Increases your bank limit by 10,000,000 coins',
    price: 8000000,
    emoji: '🌌',
    category: 'banknotes',
    bankLimitIncrease: 10000000,
    sellPrice: 4000000,
    stackable: true
  }
};

// Utility function to find item by ID number or key name
function findItemByIdentifier(identifier) {
  const itemNumber = parseInt(identifier);
  
  if (!isNaN(itemNumber)) {
    // Find item by its ID number
    const foundItem = Object.entries(STORE_ITEMS).find(([key, item]) => item.id === itemNumber.toString());
    return foundItem ? { key: foundItem[0], item: foundItem[1] } : null;
  } else {
    // Find item by key name
    const item = STORE_ITEMS[identifier.toLowerCase()];
    return item ? { key: identifier.toLowerCase(), item } : null;
  }
}

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  STORE_ITEMS,
  findItemByIdentifier,
  formatCurrency
};