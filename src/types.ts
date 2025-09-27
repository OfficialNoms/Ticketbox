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

// NEW: Audit fields
  audit_message_id: string | null;
  closed_by_user_id: string | null;
  archived_by_user_id: string | null;
};
