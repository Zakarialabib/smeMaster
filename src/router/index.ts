import {
  createRouter,
  createHashHistory,
  createMemoryHistory,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree";

// In a browser we use hash history. In non-DOM contexts (Node test env, SSR,
// or any environment where `window` is unavailable) fall back to an in-memory
// history so router construction does not throw.
const history =
  typeof window !== "undefined"
    ? createHashHistory()
    : createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({
  routeTree,
  history,
  defaultPreload: false,
});

// Type-safe router module augmentation
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
