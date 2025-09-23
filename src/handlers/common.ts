import type { Interaction } from 'discord.js';

export async function ensureDeferred(interaction: Interaction & { deferred?: boolean; replied?: boolean }) {
  if (!interaction.isRepliable()) return;
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ flags: 64 }); // ephemeral ack
    } catch {
      // ignore if already acknowledged
    }
  }
}
