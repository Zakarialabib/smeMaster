import { invokeCommand } from "@shared/services/db/invoke/command";
import { useLiveQuery } from "@shared/hooks/useLiveQuery";

export interface Message {
  id: string;
  thread_id: string;
  subject: string;
  from_addr: string;
  to_addrs: string[];
  received_at: string;
  is_read: boolean;
  folder_id?: string;
}

export interface Thread {
  id: string;
  subject: string;
  last_message_at: string;
  unread_count: number;
  participant_count: number;
}

export interface Contact {
  id: string;
  email: string;
  display_name: string;
  company?: string;
  tags: string[];
  last_contacted_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "paused";
  sent_count: number;
  total_recipients: number;
  created_at: string;
}

export function useLiveMessages(folderId: string) {
  return useLiveQuery<Message[]>(
    () => invokeCommand<Message[]>("db_list_messages", { folderId }),
    { watch: ["messages", "threads", "labels"] }
  );
}

export function useLiveThreads() {
  return useLiveQuery<Thread[]>(
    () => invokeCommand<Thread[]>("db_list_threads"),
    { watch: ["threads", "messages"] }
  );
}

export function useLiveUnreadCount() {
  return useLiveQuery<number>(
    () => invokeCommand<number>("db_count_unread"),
    { watch: ["messages", "threads"] }
  );
}

export function useLiveContacts() {
  return useLiveQuery<Contact[]>(
    () => invokeCommand<Contact[]>("db_list_contacts"),
    { watch: ["contacts", "contact_tags", "contact_groups", "contact_labels"] }
  );
}

export function useLiveContact(id: string | null) {
  return useLiveQuery<Contact | null>(
    () => (id ? invokeCommand<Contact | null>("db_get_contact", { id }) : Promise.resolve(null)),
    { watch: ["contacts", "contact_tags"], enabled: !!id }
  );
}

export function useLiveCampaigns() {
  return useLiveQuery<Campaign[]>(
    () => invokeCommand<Campaign[]>("db_list_campaigns"),
    {
      watch: [
        "campaigns",
        "campaign_recipients",
        "campaign_sends",
        "campaign_analytics",
      ],
    }
  );
}

export function useLiveCampaign(id: string | null) {
  return useLiveQuery<Campaign | null>(
    () =>
      id ? invokeCommand<Campaign | null>("db_get_campaign", { id }) : Promise.resolve(null),
    {
      watch: [
        "campaigns",
        "campaign_recipients",
        "campaign_sends",
        "campaign_analytics",
      ],
      enabled: !!id,
    }
  );
}
