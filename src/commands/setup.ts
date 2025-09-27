import type { Interaction, TextChannel } from 'discord.js';
import { ChannelType, PermissionsBitField as PBF } from 'discord.js';
import { createSetupEmbed, pickSetupChannel, sendSetupEmbedToChannel } from '../setup';

export async function handleSetupCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup') return false;

  if (!interaction.guild) {
    await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const hasPerm =
    member?.permissions.has(PBF.Flags.Administrator) ||
    member?.permissions.has(PBF.Flags.ManageGuild);
  if (!hasPerm) {
    await interaction.reply({ content: 'You need **Administrator** or **Manage Server** to use /setup.', ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });

  // Prefer the current channel if it is a text channel we can talk in
  let target: TextChannel | null = null;
  if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
    target = interaction.channel as TextChannel;
  } else {
    target = await pickSetupChannel(interaction.guild);
  }

  if (!target) {
    await interaction.editReply({
      content: 'I could not find a text channel I can post in. Please grant me Send Messages in a text channel and re-run `/setup`.',
    });
    return true;
  }

  try {
    await sendSetupEmbedToChannel(target);
    await interaction.editReply({ content: `✅ Posted setup instructions in ${target}.` });
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to post setup instructions: ${e.message ?? 'unknown error'}` });
  }
  return true;
}
