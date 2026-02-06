import { PermissionFlagsBits } from 'discord.js';
import { loadPermissions } from '../database/guildData.js';

// Check if user has required permission (Admin OR specified role)
export function hasPermission(member, permissionType) {
  // Always allow Discord Administrators
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if user has any of the specified roles
  const permissions = loadPermissions(member.guild.id);
  const allowedRoles = permissions[permissionType] || [];
  
  if (!member.roles || !member.roles.cache) {
    return false;
  }

  return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

// For slash commands (permissions are strings, not objects)
export function hasPermissionSlash(member, permissionType, guildId) {
  // Always allow Discord Administrators
  if (member && member.permissions && 
    (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if user has any of the specified roles
  const permissions = loadPermissions(guildId);
  const allowedRoles = permissions[permissionType] || [];
  
  if (!member.roles || allowedRoles.length === 0) {
    return false;
  }

  return allowedRoles.some(roleId => member.roles.includes(roleId));
}
