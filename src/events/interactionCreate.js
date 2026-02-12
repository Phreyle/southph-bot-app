import { InteractionResponseType } from 'discord-interactions';
import { DiscordRequest } from '../../utils.js';
import { 
  handleApplyTicket, 
  handleClaimTicket, 
  handleCloseTicket 
} from '../systems/ticket/ticket-system.js';
import { buildPaginatedHelpEmbeds, buildHelpNavigationButtons } from '../utils/embedBuilder.js';
import { registerUser } from '../systems/albion/albion.js';
import { EmbedBuilder } from 'discord.js';

export async function handleInteractionCreate(interaction) {
  try {
    // Handle button interactions
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Albion registration button handler
    if (customId.startsWith('albion_register_')) {
      // Parse custom ID: albion_register_userId_region_playerId
      const parts = customId.split('_');
      const userId = parts[2];
      const region = parts[3];
      const playerId = parts.slice(4).join('_'); // Handle IDs with underscores

      // Check if the button clicker is the same user who initiated registration
      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: '❌ This registration is not for you. Please use `/register` to register your own character.',
          ephemeral: true
        });
        return;
      }

      // Defer the reply
      await interaction.deferReply({ ephemeral: true });

      // Perform registration with the player ID
      const result = await registerUser(interaction.guild, userId, region, null, playerId);

      if (!result.success) {
        await interaction.editReply({
          content: `❌ Registration failed: ${result.message}`
        });
        return;
      }

      // Success - send confirmation
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Registration Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'In-Game Name', value: result.data.ign, inline: true },
          { name: 'Guild', value: result.data.guild, inline: true },
          { name: 'Region', value: region.toUpperCase(), inline: true }
        )
        .setTimestamp();

      if (result.data.roleAssigned) {
        embed.addFields({ name: 'Role', value: '✅ Assigned', inline: true });
      }

      if (result.data.nicknameApplied) {
        embed.addFields({ name: 'Nickname', value: `✅ ${result.data.nickname}`, inline: false });
      }

      await interaction.editReply({
        embeds: [embed]
      });

      // Try to delete the original selection message
      try {
        await interaction.message.delete();
      } catch (error) {
        console.log('Could not delete selection message:', error.message);
      }

      return;
    }

    // Ticket system buttons
    if (customId === 'apply_ticket') {
      await handleApplyTicket(interaction);
      return;
    }

    if (customId === 'ticket_claim') {
      await handleClaimTicket(interaction);
      return;
    }

    if (customId === 'ticket_close') {
      await handleCloseTicket(interaction);
      return;
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      }).catch(console.error);
    }
  }
}

// Button interactions handler for Express endpoint
export async function handleButtonInteractions(req, res, client) {
  const componentId = req.body.data.custom_id;

  // Albion registration button handler
  if (componentId.startsWith('albion_register_')) {
    console.log('🎮 Albion registration button clicked');
    const parts = componentId.split('_');
    const requestUserId = parts[2];
    const region = parts[3];
    const playerId = parts.slice(4).join('_');
    
    const clickerId = req.body.member?.user?.id || req.body.user?.id;

    // Check if the button clicker is the same user who initiated registration
    if (clickerId !== requestUserId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ This registration is not for you. Please use `/register` to register your own character.',
          flags: 64
        }
      });
    }

    // Defer response
    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: 64 }
    });

    try {
      const guild = client.guilds.cache.get(req.body.guild_id);
      const result = await registerUser(guild, requestUserId, region, null, playerId);

      if (!result.success) {
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `❌ Registration failed: ${result.message}`,
            flags: 64
          }
        });
        return;
      }

      // Success
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Registration Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'In-Game Name', value: result.data.ign, inline: true },
          { name: 'Guild', value: result.data.guild, inline: true },
          { name: 'Region', value: region.toUpperCase(), inline: true }
        )
        .setTimestamp();

      if (result.data.roleAssigned) {
        embed.addFields({ name: 'Role', value: '✅ Assigned', inline: true });
      }

      if (result.data.nicknameApplied) {
        embed.addFields({ name: 'Nickname', value: `✅ ${result.data.nickname}`, inline: false });
      }

      await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        body: {
          embeds: [embed.toJSON()],
          components: [], // Remove buttons
          flags: 64
        }
      });

    } catch (error) {
      console.error('Error in albion registration button:', error);
      await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        body: {
          content: '❌ An unexpected error occurred during registration.',
          flags: 64
        }
      });
    }
    return;
  }

  // Ticket system button handlers
  if (componentId === 'apply_ticket') {
    console.log('🎫 Apply ticket button clicked');
    const interaction = {
      customId: componentId,
      guildId: req.body.guild_id,
      user: req.body.member?.user || req.body.user,
      member: req.body.member,
      channelId: req.body.channel_id,
      guild: client.guilds.cache.get(req.body.guild_id),
      deferReply: async (options) => {
        return res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: options?.ephemeral ? 64 : 0 }
        });
      },
      editReply: async (options) => {
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: options.content,
            embeds: options.embeds?.map(e => e.toJSON?.() || e),
            flags: options.ephemeral ? 64 : 0
          }
        });
      },
      reply: async (options) => {
        if (!res.headersSent) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: options.content,
              embeds: options.embeds?.map(e => e.toJSON?.() || e),
              flags: options.ephemeral ? 64 : 0
            }
          });
        }
      }
    };

    await handleApplyTicket(interaction);
    return;
  }

  if (componentId === 'ticket_claim') {
    console.log('✋ Claim ticket button clicked');
    const guild = client.guilds.cache.get(req.body.guild_id);
    const userId = req.body.member?.user?.id || req.body.user?.id;
    
    // Fetch the member from guild to get proper roles
    let guildMember = null;
    if (guild && userId) {
      try {
        guildMember = await guild.members.fetch(userId);
      } catch (error) {
        console.error('Failed to fetch member:', error);
      }
    }

    const interaction = {
      customId: componentId,
      guildId: req.body.guild_id,
      user: req.body.member?.user || req.body.user,
      member: guildMember,
      channelId: req.body.channel_id,
      guild: guild,
      reply: async (options) => {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: options.content,
            embeds: options.embeds?.map(e => e.toJSON?.() || e),
            flags: options.ephemeral ? 64 : 0
          }
        });
      }
    };

    await handleClaimTicket(interaction);
    return;
  }

  if (componentId === 'ticket_close') {
    console.log('🔒 Close ticket button clicked');
    const guild = client.guilds.cache.get(req.body.guild_id);
    const userId = req.body.member?.user?.id || req.body.user?.id;
    
    // Fetch the member from guild to get proper roles
    let guildMember = null;
    if (guild && userId) {
      try {
        guildMember = await guild.members.fetch(userId);
      } catch (error) {
        console.error('Failed to fetch member:', error);
      }
    }

    const interaction = {
      customId: componentId,
      guildId: req.body.guild_id,
      user: req.body.member?.user || req.body.user,
      member: guildMember,
      channelId: req.body.channel_id,
      guild: guild,
      channel: guild?.channels.cache.get(req.body.channel_id),
      deferReply: async (options) => {
        return res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: options?.ephemeral ? 64 : 0 }
        });
      },
      editReply: async (options) => {
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: options.content,
            embeds: options.embeds?.map(e => e.toJSON?.() || e),
            flags: options.ephemeral ? 64 : 0
          }
        });
      },
      reply: async (options) => {
        if (!res.headersSent) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: options.content,
              embeds: options.embeds?.map(e => e.toJSON?.() || e),
              flags: options.ephemeral ? 64 : 0
            }
          });
        }
      },
      deferred: false
    };

    await handleCloseTicket(interaction);
    return;
  }

  // Help pagination buttons
  if (componentId.startsWith('help_prev_') || componentId.startsWith('help_next_')) {
    console.log('📖 Help pagination button clicked');
    const guildId = req.body.guild_id;
    const member = req.body.member;
    
    // Extract current page from button ID
    const currentPage = parseInt(componentId.split('_')[2]);
    const isNext = componentId.startsWith('help_next_');
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    // Build help pages
    const pages = buildPaginatedHelpEmbeds(member, guildId, true);
    
    // Validate page number
    if (newPage < 0 || newPage >= pages.length) {
      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {}
      });
    }
    
    // Build new navigation buttons
    const buttons = buildHelpNavigationButtons(newPage, pages.length);
    
    // Update the message with new page
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: [pages[newPage].toJSON()],
        components: [buttons.toJSON()],
        flags: 64
      }
    });
  }

  console.error(`❌ Unknown component ID: ${componentId}`);
  return res.status(400).json({ error: 'unknown component' });
}
