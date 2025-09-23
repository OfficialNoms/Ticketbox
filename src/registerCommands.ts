import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, ChannelType } from 'discord.js';

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

/* NEW: config */
const config = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Guild configuration (admin only)')
  .addSubcommand(s =>
    s
      .setName('show')
      .setDescription('Show current Ticketbox settings for this server')
  )
  .addSubcommand(s =>
    s
      .setName('set_auditlog')
      .setDescription('Set the Audit Log channel used by Ticketbox')
      .addChannelOption(o =>
        o.setName('channel')
         .setDescription('Select a text channel')
         .addChannelTypes(ChannelType.GuildText)
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
