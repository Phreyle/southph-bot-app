import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config/constants.js';

// Utility functions for per-guild files
const getPrefixFile = (guildId) => path.join(DATA_DIR, `prefix-config-${guildId}.json`);
const getPermissionsFile = (guildId) => path.join(DATA_DIR, `permissions-config-${guildId}.json`);

// Load per-guild prefix
export function loadPrefix(guildId) {
  try {
    const file = getPrefixFile(guildId);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading prefix for guild ${guildId}:`, e);
  }
  return { prefix: "!" }; // default prefix
}

// Save per-guild prefix
export function savePrefix(guildId, prefix) {
  try {
    const file = getPrefixFile(guildId);
    fs.writeFileSync(file, JSON.stringify({ prefix }, null, 2));
    console.log(`✅ Prefix changed to: ${prefix} for guild ${guildId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving prefix for guild ${guildId}:`, error);
    return false;
  }
}

// Load per-guild permissions
export function loadPermissions(guildId) {
  try {
    const file = getPermissionsFile(guildId);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        bankAdminRoles: Array.isArray(data.bankAdminRoles) ? data.bankAdminRoles : [],
        ctaRegearRoles: Array.isArray(data.ctaRegearRoles) ? data.ctaRegearRoles : [],
        contentAdminRoles: Array.isArray(data.contentAdminRoles) ? data.contentAdminRoles : [],
      };
    }
  } catch (e) {
    console.error(`Error loading permissions for guild ${guildId}:`, e);
  }
  return { bankAdminRoles: [], ctaRegearRoles: [], contentAdminRoles: [] };
}

// Save per-guild permissions
export function savePermissions(guildId, data) {
  try {
    const file = getPermissionsFile(guildId);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`✅ Permissions saved successfully for guild ${guildId}`);
  } catch (e) {
    console.error(`Error saving permissions for guild ${guildId}:`, e);
  }
}
