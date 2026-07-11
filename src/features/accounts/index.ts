export type { Account } from "./stores/accountStore";
export type { Account as DbAccount } from "../../shared/services/db/db-invoke";
export { useAccountStore } from "./stores/accountStore";

export {
  getAllAccounts,
  insertAccount,
  updateAccountTokens,
  updateAccountSyncState,
  clearAccountHistoryId,
  updateAccountAllTokens,
  deleteAccount,
  insertImapAccount,
  getAccount,
  getAccountByEmail,
} from "./db/accounts";
