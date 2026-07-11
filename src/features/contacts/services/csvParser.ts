import Papa from "papaparse";

export interface CsvContact {
  email: string;
  display_name: string | null;
  notes: string | null;
}

const EMAIL_ALIASES = ["email", "e-mail", "mail"];
const NAME_ALIASES = ["name", "display_name", "display name", "full_name", "full name"];
const FIRST_NAME_ALIASES = ["first_name", "first name", "given_name", "given name"];
const LAST_NAME_ALIASES = ["last_name", "last name", "family_name", "family name"];
const NOTES_ALIASES = ["notes", "note", "comment", "description"];

function findColumn(headers: string[], aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === alias);
    if (idx !== -1) return idx;
  }
  return undefined;
}

export function parseCsvContent(content: string): CsvContact[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parse warnings:", result.errors);
  }

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) return [];

  const emailCol = findColumn(headers, EMAIL_ALIASES);
  if (emailCol === undefined) return [];

  const nameCol = findColumn(headers, NAME_ALIASES);
  const firstNameCol = findColumn(headers, FIRST_NAME_ALIASES);
  const lastNameCol = findColumn(headers, LAST_NAME_ALIASES);
  const notesCol = findColumn(headers, NOTES_ALIASES);

  const contacts: CsvContact[] = [];
  const seenEmails = new Set<string>();

  for (const row of result.data) {
    const values = Object.values(row);
    const email = (values[emailCol] ?? "").trim().toLowerCase();
    if (!email) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    let displayName: string | null = null;

    if (nameCol !== undefined) {
      const name = (values[nameCol] ?? "").trim();
      if (name) displayName = name;
    }

    if (!displayName && firstNameCol !== undefined) {
      const first = (values[firstNameCol] ?? "").trim();
      const last = lastNameCol !== undefined ? (values[lastNameCol] ?? "").trim() : "";
      if (first && last) displayName = `${first} ${last}`;
      else if (first) displayName = first;
      else if (last) displayName = last;
    }

    const notes = notesCol !== undefined ? (values[notesCol] ?? "").trim() || null : null;

    contacts.push({ email, display_name: displayName, notes });
  }

  return contacts;
}
