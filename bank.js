/**
 * Bank Economy System
 * In-memory storage using Map for user balances
 */

// Currency symbol
export const CURRENCY = '💰';

// Storage: userId -> balance
const bankData = new Map();

/**
 * Get user balance
 * @param {string} userId - Discord user ID
 * @returns {number} User balance
 */
export function getBalance(userId) {
  return bankData.get(userId) || 0;
}

/**
 * Set user balance
 * @param {string} userId - Discord user ID
 * @param {number} amount - New balance amount
 * @returns {boolean} Success
 */
export function setBalance(userId, amount) {
  if (amount < 0) return false;
  if (amount === 0) {
    bankData.delete(userId);
  } else {
    bankData.set(userId, amount);
  }
  return true;
}

/**
 * Deposit money to user account
 * @param {string} userId - Discord user ID
 * @param {number} amount - Amount to deposit
 * @returns {object} Result object
 */
export function deposit(userId, amount) {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }
  
  const currentBalance = getBalance(userId);
  const newBalance = currentBalance + amount;
  
  setBalance(userId, newBalance);
  
  return { 
    success: true, 
    newBalance,
    deposited: amount
  };
}

/**
 * Withdraw money from user account
 * @param {string} userId - Discord user ID
 * @param {number} amount - Amount to withdraw
 * @returns {object} Result object
 */
export function withdraw(userId, amount) {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }
  
  const currentBalance = getBalance(userId);
  
  if (currentBalance < amount) {
    return { 
      success: false, 
      error: `Insufficient funds. Balance: ${CURRENCY}${currentBalance}` 
    };
  }
  
  const newBalance = currentBalance - amount;
  setBalance(userId, newBalance);
  
  return { 
    success: true, 
    newBalance,
    withdrawn: amount
  };
}

/**
 * Get all users with non-zero balance
 * @returns {Array} Array of [userId, balance] pairs
 */
export function getActiveUsers() {
  return Array.from(bankData.entries());
}

/**
 * Check if user has balance
 * @param {string} userId - Discord user ID
 * @returns {boolean} Has balance
 */
export function hasBalance(userId) {
  return bankData.has(userId);
}
