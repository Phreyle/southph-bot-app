import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';
import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from 'discord-interactions';
import { DATA_DIR, PORT } from './src/config/constants.js';
import { handleMessageCreate } from './src/events/messageCreate.js';
import { handleInteractionCreate, handleButtonInteractions, handleModalSubmit } from './src/events/interactionCreate.js';
import { handleSlashCommands } from './src/commands/slashCommands.js';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Create an express app
const app = express();

// Create a Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

// Gateway connected event
client.once('clientReady', () => {
  console.log(`Gateway connected as ${client.user.tag}`);
});

// Client ready event
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Message create event handler
client.on('messageCreate', async (message) => {
  await handleMessageCreate(message, client);
});

// Interaction create event handler (Gateway button interactions)
client.on('interactionCreate', async (interaction) => {
  await handleInteractionCreate(interaction);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  try {
    console.log('🔔 Interaction received:', JSON.stringify(req.body, null, 2));
    
    // Interaction type and data
    const { type, id, data, member, user } = req.body;
    
    // Extract user information
    const executor = member?.user || user;
    const userName = executor?.username || 'Unknown';
    const userId = executor?.id || 'Unknown';
    
    // Clean logging with user info
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const commandName = data?.name ? `/${data.name}` : type === 2 ? 'Button' : 'Interaction';
    console.log(`[${timestamp}] ${commandName} | User: ${userName} (${userId})`);

    /**
     * Handle verification requests
     */
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    /**
     * Handle slash command requests
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
      return await handleSlashCommands(req, res, client);
    }

    /**
     * Handle button and component interactions
     */
    if (type === InteractionType.MESSAGE_COMPONENT) {
      return await handleButtonInteractions(req, res, client);
    }

    /**
     * Handle modal submit interactions
     */
    if (type === InteractionType.MODAL_SUBMIT) {
      return await handleModalSubmit(req, res, client);
    }

    console.error('❌ Unknown interaction type:', type);
    return res.status(400).json({ error: 'unknown interaction type' });
  } catch (error) {
    console.error('❌ Error handling interaction:', error);
    
    // Try to respond to Discord if we haven't already
    if (!res.headersSent) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ An error occurred while processing your command. Please try again.',
          flags: 64
        },
      });
    }
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log('Listening on port ', PORT, ' ✅');
});
