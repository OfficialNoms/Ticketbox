import type { Interaction } from 'discord.js';
import { PermissionsBitField as PBF, EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildSettings, setAuditLogChannel } from '../settings';

export async function handleConfigCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'config') return false;
  if (!interaction.guild) {
    await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const hasPerm =
    member?.permissions.has(PBF.Flags.Administrator) ||
    member?.permissions.has(PBF.Flags.ManageGuild);
  if (!hasPerm) {
    await interaction.reply({ content: 'You need **Administrator** or **Manage Server** to use /config.', ephemeral: true });
    return true;
  }

  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  if (sub === 'show') {
    const g = getGuildSettings(interaction.guild.id);
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Ticketbox — Current Settings')
      .addFields(
        { name: 'Moderator roles', value: (g.moderator_role_ids?.map(id => `<@&${id}>`).join(', ')) || '—', inline: false },
        { name: 'On-Duty role', value: g.on_duty_role_id ? `<@&${g.on_duty_role_id}>` : '—', inline: true },
        { name: 'Tickets category', value: g.tickets_category_id ? `<#${g.tickets_category_id}>` : '—', inline: true },
        { name: 'Archive category', value: g.tickets_archive_category_id ? `<#${g.tickets_archive_category_id}>` : '—', inline: true },
        { name: 'Log channel', value: g.log_channel_id ? `<#${g.log_channel_id}>` : '—', inline: true },
        { name: 'Audit Log channel', value: g.audit_log_channel_id ? `<#${g.audit_log_channel_id}>` : '—', inline: true },
        { name: 'Fallback ping if no On-Duty', value: g.fallback_ping_mod_if_no_on_duty ? 'Enabled' : 'Disabled', inline: true }
      )
      .setTimestamp(new Date());
    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  if (sub === 'set_auditlog') {
    const ch = interaction.options.getChannel('channel', true);
    if (ch.guildId !== interaction.guild.id || ch.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: 'Please choose a text channel in this server.' });
      return true;
    }
    setAuditLogChannel(interaction.guild.id, ch.id);
    await interaction.editReply({ content: `✅ Audit Log channel set to ${ch}.` });
    return true;
  }

  return false;
}
