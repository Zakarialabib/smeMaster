import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree";

const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: false,
});

// Type-safe router module augmentation
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
