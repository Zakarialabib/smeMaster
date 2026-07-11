export { useShortcutStore } from "./stores/shortcutStore";

export {
  getSetting,
  setSetting,
  getAllSettings,
  getSecureSetting,
  setSecureSetting,
} from "./db/settings";

export type {
  QuickStep,
  QuickStepAction,
} from "./services/quickSteps/types";

export { executeQuickStep } from "./services/quickSteps/executor";
