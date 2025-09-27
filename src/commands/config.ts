/*
 * Ticketbox
 * File: src/commands/config.ts 
 * Created by github.com/officialnoms
 * File Description: /config command handler
 */

import type { Interaction } from 'discord.js';
import { PermissionsBitField as PBF, EmbedBuilder } from 'discord.js';
import { getGuildSettings, setGuildSetting } from '../settings';
import { validateGuild, renderValidationEmbed } from '../validation';

const SETTING_CHOICES = [
  'moderator_role_ids',
  'on_duty_role_id',
  'tickets_category_id',
  'tickets_archive_category_id',
  'log_channel_id',
  'audit_log_channel_id',
  'fallback_ping_mod_if_no_on_duty',
  'transcript_enabled',
] as const;

type SettingKey = typeof SETTING_CHOICES[number];

function parseBool(input: string): boolean | null {
  const v = input.trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'enable', 'enabled'].includes(v)) return true;
  if (['false', '0', 'no', 'off', 'disable', 'disabled'].includes(v)) return false;
  return null;
}

function extractIds(input: string): string[] {
  return input.match(/\d{5,}/g) ?? [];
}

export async function handleConfigCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'config') return false;
  if (!interaction.guild) {
    await interaction.reply({ content: 'Use this in a server.', flags: 64 });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const hasPerm =
    member?.permissions.has(PBF.Flags.Administrator) ||
    member?.permissions.has(PBF.Flags.ManageGuild);
  if (!hasPerm) {
    await interaction.reply({ content: 'You need **Administrator** or **Manage Server** to use /config.', flags: 64 });
    return true;
  }

  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ flags: 64 });

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
        { name: 'Fallback ping if no On-Duty', value: g.fallback_ping_mod_if_no_on_duty ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Transcripts', value: g.transcript_enabled ? 'Enabled' : 'Disabled', inline: true },
      )
      .setTimestamp(new Date());
    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  if (sub === 'set') {
    const key = interaction.options.getString('setting', true) as SettingKey;
    const raw = interaction.options.getString('value', true);

    try {
      if (key === 'moderator_role_ids') {
        const ids = extractIds(raw);
        if (ids.length === 0) {
          await interaction.editReply({ content: 'Provide one or more role mentions/IDs separated by commas/spaces.' });
          return true;
        }
        setGuildSetting(interaction.guild.id, key, ids);
        await interaction.editReply({ content: `✅ Set **${key}** to ${ids.map(id => `<@&${id}>`).join(', ')}` });
        return true;
      }

      if (key === 'on_duty_role_id') {
        const id = extractIds(raw)[0] ?? '';
        if (!id) {
          setGuildSetting(interaction.guild.id, key, null);
          await interaction.editReply({ content: `✅ Cleared **${key}**.` });
          return true;
        }
        setGuildSetting(interaction.guild.id, key, id);
        await interaction.editReply({ content: `✅ Set **${key}** to <@&${id}>` });
        return true;
      }

      if (key === 'tickets_category_id' || key === 'tickets_archive_category_id') {
        const id = extractIds(raw)[0] ?? '';
        if (!id) {
          setGuildSetting(interaction.guild.id, key, null);
          await interaction.editReply({ content: `✅ Cleared **${key}**.` });
          return true;
        }
        setGuildSetting(interaction.guild.id, key, id);
        await interaction.editReply({ content: `✅ Set **${key}** to <#${id}>` });
        return true;
      }

      if (key === 'log_channel_id' || key === 'audit_log_channel_id') {
        const id = extractIds(raw)[0] ?? '';
        if (!id) {
          setGuildSetting(interaction.guild.id, key, null);
          await interaction.editReply({ content: `✅ Cleared **${key}**.` });
          return true;
        }
        setGuildSetting(interaction.guild.id, key, id);
        await interaction.editReply({ content: `✅ Set **${key}** to <#${id}>` });
        return true;
      }

      if (key === 'fallback_ping_mod_if_no_on_duty' || key === 'transcript_enabled') {
        const b = parseBool(raw);
        if (b === null) {
          await interaction.editReply({ content: 'Use: `on/off`, `true/false`, `yes/no`, or `1/0`.' });
          return true;
        }
        setGuildSetting(interaction.guild.id, key, b);
        await interaction.editReply({ content: `✅ Set **${key}** to **${b ? 'true' : 'false'}**.` });
        return true;
      }

      await interaction.editReply({ content: 'Unsupported setting.' });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to set: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  if (sub === 'validate') {
    try {
      const checks = await validateGuild(interaction.guild);
      const embed = renderValidationEmbed(interaction.guild, checks);
      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `Validation failed: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  return false;
}
