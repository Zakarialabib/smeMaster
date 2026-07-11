import { searchMessages, type SearchResult } from "@shared/services/db/search";
import { askInbox as callAskInbox } from "./aiService";
import { fetchRagContext } from "./ragContext";

/**
 * Extract key search terms from a natural language question.
 * Uses simple heuristic: remove common stop words and question words.
 */
function extractSearchTerms(question: string): string {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "what", "which",
    "who", "whom", "this", "that", "these", "those", "am", "about", "up",
    "my", "me", "i", "we", "our", "you", "your", "he", "she", "it", "they",
    "them", "his", "her", "its", "and", "but", "or", "nor", "not", "so",
    "very", "just", "also", "any", "each", "every", "all", "both", "few",
    "more", "most", "some", "such", "no", "only", "own", "same", "than",
    "too", "if", "tell", "know", "find", "get", "got",
  ]);

  return question
    .replace(/[?!.,;:'"]/g, "")
    .split(/\s+/)
    .filter((word) => !stopWords.has(word.toLowerCase()) && word.length > 1)
    .join(" ");
}

export interface AskInboxResult {
  answer: string;
  sourceMessages: SearchResult[];
}

/**
 * Answer a natural language question by searching the user's inbox
 * and using AI to synthesize an answer from the results.
 */
export async function askMyInbox(
  question: string,
  accountId: string,
): Promise<AskInboxResult> {
  // Extract search terms
  const terms = extractSearchTerms(question);
  if (!terms.trim()) {
    return {
      answer: "I couldn't understand the question. Please try rephrasing it.",
      sourceMessages: [],
    };
  }

  // Search messages using existing FTS
  let results: Awaited<ReturnType<typeof searchMessages>>;
  try {
    results = await searchMessages(terms, accountId, 15);
  } catch (err) {
    console.warn("[askInbox] Search query failed:", err);
    return {
      answer: "I couldn't search your inbox due to a database error. Please check the search functionality and try again.",
      sourceMessages: [],
    };
  }

  if (results.length === 0) {
    return {
      answer: "I couldn't find any relevant emails for your question. Try a different question or check your search terms.",
      sourceMessages: [],
    };
  }

  // Format context for AI
  const context = results
    .map((r) => {
      const date = new Date(r.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const from = r.from_name
        ? `${r.from_name} <${r.from_address}>`
        : (r.from_address ?? "Unknown");
      return `[Message ID: ${r.message_id}]\nFrom: ${from}\nDate: ${date}\nSubject: ${r.subject ?? "(no subject)"}\nPreview: ${r.snippet ?? ""}`;
    })
    .join("\n---\n");

  // Fetch RAG context for additional signal (fuse with FTS results)
  let fusedContext = context;
  try {
    const ragContext = await fetchRagContext(question);
    if (ragContext && ragContext.length > 100) {
      fusedContext = `${context}\n\n---\nKnowledge base context:\n${ragContext.slice(0, 3000)}`;
    }
  } catch {
    // RAG unavailable — use FTS only
  }

  // Call AI with fused context
  const answer = await callAskInbox(question, accountId, fusedContext);

  return { answer, sourceMessages: results };
}
