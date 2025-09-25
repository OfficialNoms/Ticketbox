import type { Interaction } from 'discord.js';

export async function ensureDeferred(interaction: Interaction & { deferred?: boolean; replied?: boolean }) {
  if (!interaction.isRepliable()) return;
  if (!interaction.deferred && !interaction.replied) {
    try {
      // Ephemeral defer for any interaction we handle
      await interaction.deferReply({ flags: 64 });
    } catch {
      // ignore if already acknowledged
    }
  }
}
