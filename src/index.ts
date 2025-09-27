import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  Interaction,
} from 'discord.js';

import './db';
import { loadConfig } from './config';

// Handlers
import { handleUserSelectMenu } from './handlers/selectMenus';
import { handleButton } from './handlers/buttons';
import { handleHelpCommand } from './commands/help';
import { handleDutyCommand } from './commands/duty';
import { handleConfigCommand } from './commands/config';
import { handleTicketCommand } from './commands/ticket';
import { handleSetupCommand } from './commands/setup';

// First-time setup
import { bootstrapGuild } from './setup';

// Command defs for auto-registration
import { getCommandsJSON } from './commands/defs';

const cfg = loadConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

async function registerCommandsForGuild(guildId: string) {
  const json = getCommandsJSON();
  try {
    await client.application?.commands.set(json, guildId);
    console.log(`[cmd] Registered ${json.length} commands for guild ${guildId}`);
  } catch (e) {
    console.warn(`[cmd] Failed to register commands for ${guildId}:`, e);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Ticketbox online as ${c.user.tag}`);
  console.log('Config loaded:', {
    moderatorRoleIds: cfg.moderatorRoleIds,
    onDutyRoleId: cfg.onDutyRoleId ? '(set)' : '(disabled)',
    ticketsCategoryId: cfg.ticketsCategoryId,
    archiveCategoryId: cfg.ticketsArchiveCategoryId,
    logChannelId: cfg.logChannelId,
  });

  for (const g of c.guilds.cache.values()) {
    const guild = await g.fetch().catch(() => null);
    if (!guild) continue;
    await bootstrapGuild(guild);
    await registerCommandsForGuild(guild.id);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  await bootstrapGuild(guild);
  await registerCommandsForGuild(guild.id);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (await handleUserSelectMenu(interaction)) return;
  if (await handleButton(interaction)) return;

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply({ content: 'pong', ephemeral: true });
    return;
  }

  if (await handleHelpCommand(interaction)) return;
  if (await handleDutyCommand(interaction)) return;
  if (await handleConfigCommand(interaction)) return;
  if (await handleTicketCommand(interaction)) return;
  if (await handleSetupCommand(interaction)) return;
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}
client.login(token);
