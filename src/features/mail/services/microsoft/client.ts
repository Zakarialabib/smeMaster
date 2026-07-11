

export interface MicrosoftGraphClientConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class MicrosoftGraphClient {
  private accountId: string;
  private clientId: string;
  private config: MicrosoftGraphClientConfig;
  private clientSecret?: string;

  constructor(
    accountId: string,
    clientId: string,
    config: MicrosoftGraphClientConfig,
    clientSecret?: string,
  ) {
    this.accountId = accountId;
    this.clientId = clientId;
    this.config = config;
    this.clientSecret = clientSecret;
  }

  /**
   * Get the current access token, refreshing if necessary.
   */
  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Math.floor(this.config.expiresAt / 1000);

    // If token expires in less than 5 minutes, refresh it
    if (expiresAt - now < 300) {
      await this.refreshToken();
    }

    return this.config.accessToken;
  }

  /**
   * Refresh the access token using the refresh token.
   */
  private async refreshToken(): Promise<void> {
    const { refreshMicrosoftAccessToken } = await import("./auth");

    const tokens = await refreshMicrosoftAccessToken(
      this.config.refreshToken,
      this.clientId,
      this.clientSecret,
    );

    this.config.accessToken = tokens.access_token;
    this.config.refreshToken = tokens.refresh_token ?? this.config.refreshToken;
    this.config.expiresAt = getCurrentUnixTimestamp() + tokens.expires_in;

    // Update in database
    const { updateAccountAllTokens } = await import("@features/accounts/db/accounts");
    await updateAccountAllTokens(this.accountId, this.config.accessToken, this.config.refreshToken, this.config.expiresAt);
  }

  /**
   * Make an authenticated request to Microsoft Graph API.
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * Get user profile.
   */
  async getMe() {
    return this.request("/me");
  }

  /**
   * Get messages (emails).
   */
  async getMessages(params?: {
    top?: number;
    skip?: number;
    filter?: string;
    orderby?: string;
    select?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.top) searchParams.set("$top", params.top.toString());
    if (params?.skip) searchParams.set("$skip", params.skip.toString());
    if (params?.filter) searchParams.set("$filter", params.filter);
    if (params?.orderby) searchParams.set("$orderby", params.orderby);
    if (params?.select) searchParams.set("$select", params.select);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request(`/me/messages${query}`);
  }

  /**
   * Get a specific message.
   */
  async getMessage(id: string) {
    return this.request(`/me/messages/${id}`);
  }

  /**
   * Send an email.
   */
  async sendMail(message: {
    subject: string;
    body: { contentType: "html" | "text"; content: string };
    toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
    ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
    bccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
    attachments?: Array<{
      "@odata.type": "#microsoft.graph.fileAttachment";
      name: string;
      contentBytes: string;
    }>;
  }) {
    return this.request("/me/sendMail", {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
  }

  /**
   * Get mail folders.
   */
  async getMailFolders() {
    return this.request("/me/mailFolders");
  }

  /**
   * Get calendar events.
   */
  async getEvents(params?: {
    top?: number;
    filter?: string;
    orderby?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.top) searchParams.set("$top", params.top.toString());
    if (params?.filter) searchParams.set("$filter", params.filter);
    if (params?.orderby) searchParams.set("$orderby", params.orderby);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request(`/me/events${query}`);
  }

  /**
   * Create a calendar event.
   */
  async createEvent(event: {
    subject: string;
    body: { contentType: "html" | "text"; content: string };
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees?: Array<{ emailAddress: { address: string; name?: string }; type: "required" | "optional" }>;
  }) {
    return this.request("/me/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
  }

  /**
   * Get contacts.
   */
  async getContacts(params?: {
    top?: number;
    filter?: string;
    orderby?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.top) searchParams.set("$top", params.top.toString());
    if (params?.filter) searchParams.set("$filter", params.filter);
    if (params?.orderby) searchParams.set("$orderby", params.orderby);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request(`/me/contacts${query}`);
  }
}

function getCurrentUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}