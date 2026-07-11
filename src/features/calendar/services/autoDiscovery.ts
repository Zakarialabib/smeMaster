import { invokeCommand } from "@shared/services/db/invoke/command";

interface CalDavPreset {
  name: string;
  domains: string[];
  caldavUrl: string;
  authMethod: "basic" | "oauth2";
}

const PRESETS: CalDavPreset[] = [
  {
    name: "Google",
    domains: ["gmail.com", "googlemail.com", "google.com"],
    caldavUrl: "https://apidata.googleusercontent.com/caldav/v2/",
    authMethod: "oauth2",
  },
  {
    name: "Microsoft",
    domains: ["outlook.com", "hotmail.com", "live.com", "office365.com", "microsoft.com"],
    caldavUrl: "https://outlook.office365.com/calendar/",
    authMethod: "oauth2",
  },
  {
    name: "iCloud",
    domains: ["icloud.com", "me.com", "mac.com"],
    caldavUrl: "https://caldav.icloud.com",
    authMethod: "basic",
  },
  {
    name: "Fastmail",
    domains: ["fastmail.com", "fastmail.fm", "messagingengine.com"],
    caldavUrl: "https://caldav.fastmail.com/",
    authMethod: "basic",
  },
  {
    name: "Zoho",
    domains: ["zoho.com", "zohomail.com"],
    caldavUrl: "https://calendar.zoho.com/caldav/",
    authMethod: "basic",
  },
  {
    name: "GMX",
    domains: ["gmx.com", "gmx.net", "gmx.de"],
    caldavUrl: "https://caldav.gmx.net/",
    authMethod: "basic",
  },
];

export interface CalDavDiscoveryResult {
  providerName: string | null;
  caldavUrl: string | null;
  authMethod: "basic" | "oauth2";
  needsAppPassword: boolean;
}

/**
 * Discover CalDAV settings from an email address.
 * Uses Rust backend to avoid CORS issues with well-known discovery.
 */
export async function discoverCalDavSettings(email: string): Promise<CalDavDiscoveryResult> {
  try {
    const result = await invokeCommand<CalDavDiscoveryResult>("discover_caldav_settings", { email });
    return result;
  } catch (err) {
    console.warn("[autoDiscovery] Rust discovery failed, using client-side fallback:", err);
    // Fallback to client-side preset matching only
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return { providerName: null, caldavUrl: null, authMethod: "basic", needsAppPassword: false };
    }

    for (const preset of PRESETS) {
      if (preset.domains.includes(domain)) {
        return {
          providerName: preset.name,
          caldavUrl: preset.caldavUrl,
          authMethod: preset.authMethod,
          needsAppPassword: preset.name === "iCloud",
        };
      }
    }

    return { providerName: null, caldavUrl: null, authMethod: "basic", needsAppPassword: false };
  }
}

/**
 * Test CalDAV connection with given credentials.
 */
export async function testCalDavConnection(
  url: string,
  username: string,
  password: string,
): Promise<{ success: boolean; message: string; calendarCount?: number }> {
  try {
    const { DAVClient } = await import("tsdav");
    const client = new DAVClient({
      serverUrl: url,
      credentials: { username, password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    await client.login();
    const calendars = await client.fetchCalendars();

    return {
      success: true,
      message: `Connected — found ${calendars.length} calendar${calendars.length !== 1 ? "s" : ""}`,
      calendarCount: calendars.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, message };
  }
}
