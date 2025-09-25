import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID!;

if (!token || !clientId || !guildId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID or GUILD_ID in .env');
  process.exit(1);
}

const ticket = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket actions')
  .addSubcommand(sub =>
    sub
      .setName('open')
      .setDescription('Open a private ticket for yourself')
      .addStringOption(opt =>
        opt.setName('subject')
           .setDescription('Short subject for your ticket')
           .setMaxLength(120)
           .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('openfor')
      .setDescription('Moderator: open a ticket for a specific user')
      .addUserOption(opt =>
        opt.setName('user')
           .setDescription('The user this ticket is for')
           .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('subject')
           .setDescription('Short subject for the ticket')
           .setMaxLength(120)
           .setRequired(false)
      )
  );

const duty = new SlashCommandBuilder()
  .setName('duty')
  .setDescription('On-Duty controls for staff')
  .addSubcommand(s => s.setName('on').setDescription('Go on duty (you will be pinged for new tickets)'))
  .addSubcommand(s => s.setName('off').setDescription('Go off duty'))
  .addSubcommand(s => s.setName('status').setDescription('Show who is on duty'));

const ping = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with pong.');

const help = new SlashCommandBuilder()
  .setName('help')
  .setDescription('How to use Ticketbox and available commands.');

const config = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Guild configuration (admin only)')
  .addSubcommand(s =>
    s.setName('show').setDescription('Show current Ticketbox settings for this server')
  )
  .addSubcommand(s =>
    s
      .setName('set')
      .setDescription('Set a Ticketbox setting')
      .addStringOption(o =>
        o.setName('setting')
         .setDescription('Setting key to change')
         .addChoices(
           { name: 'moderator_role_ids (list of roles)', value: 'moderator_role_ids' },
           { name: 'on_duty_role_id (role)', value: 'on_duty_role_id' },
           { name: 'tickets_category_id (category channel)', value: 'tickets_category_id' },
           { name: 'tickets_archive_category_id (category channel)', value: 'tickets_archive_category_id' },
           { name: 'log_channel_id (text channel)', value: 'log_channel_id' },
           { name: 'audit_log_channel_id (text channel)', value: 'audit_log_channel_id' },
           { name: 'fallback_ping_mod_if_no_on_duty (boolean)', value: 'fallback_ping_mod_if_no_on_duty' },
           { name: 'transcript_enabled (boolean)', value: 'transcript_enabled' },
         )
         .setRequired(true)
      )
      .addStringOption(o =>
        o.setName('value')
         .setDescription('Value for the setting (IDs/mentions or true/false)')
         .setRequired(true)
      )
  );

const commands = [ping, duty, ticket, help, config].map(c => c.toJSON());

async function main() {
  const rest = new REST({ version: '10' }).setToken(token);
  console.log('Registering guild commands...');
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('Done.');
}

main().catch(err => {
  console.error('Failed to register commands:', err);
  process.exit(1);
});
