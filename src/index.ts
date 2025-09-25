import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  Interaction,
} from 'discord.js';

import './db'; // ensure DB schema initialization
import { loadConfig } from './config';

// Handlers (new modular files)
import { handleUserSelectMenu } from './handlers/selectMenus';
import { handleButton } from './handlers/buttons';
import { handleHelpCommand } from './commands/help';
import { handleDutyCommand } from './commands/duty';
import { handleConfigCommand } from './commands/config';
import { handleTicketCommand } from './commands/ticket';

const cfg = loadConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ⬅️ allow reading message text for transcripts
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Ticketbox online as ${c.user.tag}`);
  console.log('Config loaded:', {
    moderatorRoleIds: cfg.moderatorRoleIds,
    onDutyRoleId: cfg.onDutyRoleId ? '(set)' : '(disabled)',
    ticketsCategoryId: cfg.ticketsCategoryId,
    archiveCategoryId: cfg.ticketsArchiveCategoryId,
    logChannelId: cfg.logChannelId,
  });
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  // Route select menus (add/remove participant)
  if (await handleUserSelectMenu(interaction)) return;

  // Route buttons (resolve/close/archive/reopen + open user picker)
  if (await handleButton(interaction)) return;

  // Simple inline command: /ping
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply({ content: 'pong', flags: 64 });
    return;
  }

  // Routed commands
  if (await handleHelpCommand(interaction)) return;
  if (await handleDutyCommand(interaction)) return;
  if (await handleConfigCommand(interaction)) return;
  if (await handleTicketCommand(interaction)) return;
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}
client.login(token);
