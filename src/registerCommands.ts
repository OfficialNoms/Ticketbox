/*
 * Ticketbox
 * File: src/registerCommands.ts
 * Created by github.com/officialnoms
 * File Description: Manual script to register slash commands
 */

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getCommandsJSON } from './commands/defs';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID!; // dev convenience: single-guild push

if (!token || !clientId || !guildId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID or GUILD_ID in .env');
  process.exit(1);
}

const commands = getCommandsJSON();

async function main() {
  const rest = new REST({ version: '10' }).setToken(token);
  console.log('Registering guild commands (manual script)...');
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('Done.');
}

main().catch(err => {
  console.error('Failed to register commands:', err);
  process.exit(1);
});
