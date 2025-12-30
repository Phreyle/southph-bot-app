/**
 * Bank Economy System
 * Persistent storage using JSON file for user balances
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Currency symbol
export const CURRENCY = '💰';

// Database file path
const DB_FILE = path.join(__dirname, 'bank-data.json');

// Storage: userId -> balance
const bankData = new Map();

/**
 * Load bank data from file
 */
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(rawData);
      
      // Load data into Map
      for (const [userId, balance] of Object.entries(data)) {
        bankData.set(userId, balance);
      }
      
      console.log(`💾 Bank data loaded: ${bankData.size} users`);
    } else {
      console.log('💾 No existing bank data found, starting fresh');
    }
  } catch (error) {
    console.error('❌ Error loading bank data:', error);
  }
}

/**
 * Save bank data to file
 */
function saveData() {
  try {
    const data = Object.fromEntries(bankData);
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Bank data saved: ${bankData.size} users`);
  } catch (error) {
    console.error('❌ Error saving bank data:', error);
  }
}

// Load data when module is imported
loadData();

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
  saveData(); // Save after every change
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

/**
 * Clear a specific user's balance
 * @param {string} userId - Discord user ID
 * @returns {object} Result object
 */
export function clearUser(userId) {
  const currentBalance = getBalance(userId);
  
  if (currentBalance === 0) {
    return {
      success: false,
      error: 'User has no balance to clear'
    };
  }
  
  bankData.delete(userId);
  saveData();
  
  return {
    success: true,
    clearedAmount: currentBalance
  };
}

/**
 * Clear all users' balances
 * @returns {object} Result object
 */
export function clearAll() {
  const userCount = bankData.size;
  
  if (userCount === 0) {
    return {
      success: false,
      error: 'No users in the bank to clear'
    };
  }
  
  bankData.clear();
  saveData();
  
  return {
    success: true,
    clearedUsers: userCount
  };
}
