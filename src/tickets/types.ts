/*
 * Ticketbox
 * File: src/tickets/types.ts
 * Created by github.com/officialnoms
 * File Description: Public types for tickets
 */

export type TicketState = 'OPEN' | 'RESOLVED_PENDING_REVIEW' | 'CLOSED' | 'ARCHIVED';

export type TicketRow = {
  id: string;
  guild_id: string;
  channel_id: string;
  creator_user_id: string;
  target_user_id: string;
  subject: string | null;
  state: TicketState;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
  archived_at: number | null;
  added_participants: string | null;
  transcript_url: string | null;
  header_message_id: string | null;
};
