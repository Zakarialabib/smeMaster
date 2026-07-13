import type { EmailProvider, EmailFolder, SyncResult } from "./types";
import type { ParsedMessage } from "@features/mail/services/gmail/messageParser";
import {
  MicrosoftGraphClient,
  type GraphMailFolder,
  type GraphMailFolderResponse,
} from "../microsoft/client";

/** Map Outlook well-known folder names to IMAP special-use flags */
const SPECIAL_USE_MAP: Record<string, string | null> = {
  inbox: null,
  sentitems: "\\Sent",
  deleteditems: "\\Trash",
  drafts: "\\Drafts",
  junkemail: "\\Junk",
  archive: "\\Archive",
};

interface GraphEmailAddress {
  name?: string;
  address: string;
}

interface GraphRecipient {
  emailAddress: GraphEmailAddress;
}

interface GraphBody {
  contentType: "html" | "text";
  content: string;
}

interface GraphMessage {
  id: string;
  conversationId?: string;
  conversationIndex?: string;
  subject?: string;
  body?: GraphBody;
  bodyPreview?: string;
  from?: { emailAddress: GraphEmailAddress };
  sender?: { emailAddress: GraphEmailAddress };
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  bccRecipients?: GraphRecipient[];
  replyTo?: GraphRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
  flag?: { flagStatus: string };
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  parentFolderId?: string;
  webLink?: string;
}

/**
 * EmailProvider adapter that wraps the MicrosoftGraphClient.
 * Delegates all operations to the Microsoft Graph API.
 */
export class MicrosoftGraphEmailProvider implements EmailProvider {
  readonly accountId: string;
  readonly type = "microsoft_graph" as const;
  private client: MicrosoftGraphClient;
  private folderCache: GraphMailFolder[] | null = null;

  constructor(accountId: string, client: MicrosoftGraphClient) {
    this.accountId = accountId;
    this.client = client;
  }

  // ── Folder/Label operations ─────────────────────────────────────────────

  async listFolders(): Promise<EmailFolder[]> {
    const resp = await this.client.request<GraphMailFolderResponse>(
      "/me/mailFolders",
    );
    this.folderCache = resp.value;
    return resp.value.map((folder) => ({
      id: folder.id,
      name: folder.displayName,
      path: folder.id,
      type: folder.wellKnownName ? "system" : "user",
      specialUse: folder.wellKnownName
        ? (SPECIAL_USE_MAP[folder.wellKnownName.toLowerCase()] ?? null)
        : null,
      delimiter: "/",
      messageCount: folder.totalItemCount ?? 0,
      unreadCount: folder.unreadItemCount ?? 0,
    }));
  }

  async createFolder(name: string, parentPath?: string): Promise<EmailFolder> {
    const body = { displayName: name };
    const endpoint = parentPath
      ? `/me/mailFolders/${parentPath}/childFolders`
      : "/me/mailFolders";
    const folder = await this.client.request<GraphMailFolder>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      id: folder.id,
      name: folder.displayName,
      path: folder.id,
      type: "user",
      specialUse: null,
      delimiter: "/",
      messageCount: 0,
      unreadCount: 0,
    };
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.client.request(`/me/mailFolders/${folderId}`, {
      method: "DELETE",
    });
  }

  async renameFolder(folderId: string, newName: string): Promise<void> {
    await this.client.request(`/me/mailFolders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: newName }),
    });
  }

  // ── Sync operations ─────────────────────────────────────────────────────

  async initialSync(
    _daysBack: number,
    _onProgress?: (phase: string, current: number, total: number) => void,
  ): Promise<SyncResult> {
    // Initial sync is handled by the existing sync module.
    return {
      messages: [],
      latestSyncToken: undefined,
    };
  }

  async deltaSync(_syncToken: string): Promise<SyncResult> {
    return { messages: [], latestSyncToken: _syncToken };
  }

  // ── Message operations ──────────────────────────────────────────────────

  async fetchMessage(messageId: string): Promise<ParsedMessage> {
    const msg = await this.client.request<GraphMessage>(
      `/me/messages/${messageId}`,
    );
    return this.graphMessageToParsed(msg);
  }

  async fetchAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<{ data: string; size: number }> {
    // Get attachment metadata for the size
    const att = await this.client.request<{ size: number }>(
      `/me/messages/${messageId}/attachments/${attachmentId}`,
    );

    // Get the raw content bytes
    const token = await this.client.getAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Microsoft Graph API error: ${response.status} - Failed to fetch attachment`,
      );
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    const data = btoa(binary);

    return { data, size: att.size };
  }

  async fetchRawMessage(messageId: string): Promise<string> {
    const token = await this.client.getAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/$value`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Microsoft Graph API error: ${response.status} - Failed to fetch raw message`,
      );
    }

    return response.text();
  }

  // ── Actions (operate on thread/message level) ───────────────────────────

  async archive(_threadId: string, messageIds: string[]): Promise<void> {
    const destinationId = await this.getWellKnownFolderId("archive");
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}/move`, {
        method: "POST",
        body: JSON.stringify({ destinationId }),
      });
    }
  }

  async trash(_threadId: string, messageIds: string[]): Promise<void> {
    const destinationId = await this.getWellKnownFolderId("deleteditems");
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}/move`, {
        method: "POST",
        body: JSON.stringify({ destinationId }),
      });
    }
  }

  async permanentDelete(
    _threadId: string,
    messageIds: string[],
  ): Promise<void> {
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}`, {
        method: "DELETE",
      });
    }
  }

  async markRead(
    _threadId: string,
    messageIds: string[],
    read: boolean,
  ): Promise<void> {
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: read }),
      });
    }
  }

  async star(
    _threadId: string,
    messageIds: string[],
    starred: boolean,
  ): Promise<void> {
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}`, {
        method: "PATCH",
        body: JSON.stringify({
          flag: { flagStatus: starred ? "flagged" : "notFlagged" },
        }),
      });
    }
  }

  async spam(
    _threadId: string,
    messageIds: string[],
    isSpam: boolean,
  ): Promise<void> {
    const destinationId = await this.getWellKnownFolderId(
      isSpam ? "junkemail" : "inbox",
    );
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}/move`, {
        method: "POST",
        body: JSON.stringify({ destinationId }),
      });
    }
  }

  async moveToFolder(
    _threadId: string,
    messageIds: string[],
    folderPath: string,
  ): Promise<void> {
    for (const msgId of messageIds) {
      await this.client.request(`/me/messages/${msgId}/move`, {
        method: "POST",
        body: JSON.stringify({ destinationId: folderPath }),
      });
    }
  }

  async addLabel(_threadId: string, _labelId: string): Promise<void> {
    // Microsoft Graph does not have user-created labels on messages.
    // Categories are the closest equivalent but differ in behavior.
  }

  async removeLabel(_threadId: string, _labelId: string): Promise<void> {
    // No-op for Microsoft Graph
  }

  // ── Send/Draft operations ───────────────────────────────────────────────

  async sendMessage(
    rawBase64Url: string,
    _threadId?: string,
  ): Promise<{ id: string }> {
    return this.client.sendRawMime(rawBase64Url);
  }

  async createDraft(
    rawBase64Url: string,
    _threadId?: string,
  ): Promise<{ draftId: string }> {
    const result = await this.client.createDraftFromMime(rawBase64Url);
    return { draftId: result.id };
  }

  async updateDraft(
    draftId: string,
    rawBase64Url: string,
    _threadId?: string,
  ): Promise<{ draftId: string }> {
    await this.client.updateDraftMime(draftId, rawBase64Url);
    return { draftId };
  }

  async deleteDraft(draftId: string): Promise<void> {
    await this.client.deleteDraft(draftId);
  }

  // ── Connection ──────────────────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const profile = await this.client.getMe();
      const email = profile.userPrincipalName || profile.mail || "";
      return {
        success: true,
        message: `Connected as ${email}`,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error ? err.message : "Unknown connection error",
      };
    }
  }

  async getProfile(): Promise<{ email: string; name?: string }> {
    const profile = await this.client.getMe();
    return {
      email: profile.userPrincipalName || profile.mail || "",
      name: profile.displayName || undefined,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async getWellKnownFolderId(wellKnownName: string): Promise<string> {
    if (!this.folderCache) {
      await this.listFolders();
    }
    const folder = this.folderCache?.find(
      (f) => f.wellKnownName?.toLowerCase() === wellKnownName.toLowerCase(),
    );
    if (folder) return folder.id;
    // Fallback: return the well-known name directly as the Graph API
    // often accepts these as shortcuts in the URL path
    return wellKnownName;
  }

  private graphMessageToParsed(msg: GraphMessage): ParsedMessage {
    const headers = msg.internetMessageHeaders ?? [];
    const getHeader = (name: string): string | null =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
        ?.value ?? null;

    const from = msg.from?.emailAddress;
    const sender = msg.sender?.emailAddress;
    const effectiveFrom = from ?? sender;

    return {
      id: msg.id,
      threadId: msg.conversationId ?? msg.id,
      fromAddress: effectiveFrom?.address ?? null,
      fromName: effectiveFrom?.name ?? null,
      toAddresses:
        msg.toRecipients
          ?.map((r) => r.emailAddress.address)
          .join(", ") ?? null,
      ccAddresses:
        msg.ccRecipients
          ?.map((r) => r.emailAddress.address)
          .join(", ") ?? null,
      bccAddresses:
        msg.bccRecipients
          ?.map((r) => r.emailAddress.address)
          .join(", ") ?? null,
      replyTo: msg.replyTo?.[0]?.emailAddress.address ?? null,
      subject: msg.subject ?? null,
      snippet: msg.bodyPreview ?? "",
      date: msg.receivedDateTime
        ? new Date(msg.receivedDateTime).getTime()
        : Date.now(),
      isRead: msg.isRead ?? true,
      isStarred: msg.flag?.flagStatus === "flagged",
      bodyHtml:
        msg.body?.contentType === "html" ? (msg.body.content ?? null) : null,
      bodyText:
        msg.body?.contentType === "text" ? (msg.body.content ?? null) : null,
      rawSize: 0,
      internalDate: msg.receivedDateTime
        ? new Date(msg.receivedDateTime).getTime()
        : Date.now(),
      labelIds: [],
      hasAttachments: msg.hasAttachments ?? false,
      attachments: (msg.attachments ?? []).map((a) => ({
        filename: a.name,
        mimeType: a.contentType,
        size: a.size,
        gmailAttachmentId: a.id,
        contentId: null,
        isInline: false,
      })),
      listUnsubscribe: getHeader("List-Unsubscribe"),
      listUnsubscribePost: getHeader("List-Unsubscribe-Post"),
      authResults: getHeader("Authentication-Results"),
    };
  }
}
