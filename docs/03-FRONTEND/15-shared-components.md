# Shared Component & Hook Library

> **Location:** `src/shared/components/`, `src/shared/hooks/`, `src/shared/utils/`
> **Status:** Stable — adopt these before writing feature-local primitives.

This library is the frontend's reusable UI + stability toolkit. It exists to
stop features from re-implementing spinners, dialogs, error boundaries, retry
logic, and persistence by hand. Everything here is **TypeScript-strict, zero
`any` in new code, and architecture-clean** (no DB access, no rendering in
services).

---

## UI Primitives — `src/shared/components/`

### `ErrorBoundary.tsx`

Class-based error boundary that catches render-time errors in a subtree and
shows a fallback instead of white-screening the app.

| Prop        | Type                                           | Notes              |
| ----------- | ---------------------------------------------- | ------------------ |
| `children`  | `ReactNode`                                    | Subtree to guard   |
| `fallback?` | `ReactNode`                                    | Custom fallback UI |
| `onError?`  | `(error: Error, errorInfo: ErrorInfo) => void` | Reporting hook     |

```tsx
<ErrorBoundary onError={(e) => logger.error(e)}>
  <RiskyFeature />
</ErrorBoundary>
```

### `ConfirmationDialog.tsx`

Reusable confirm/cancel modal. Use it instead of a hand-rolled confirm overlay.

| Prop           | Type                                           | Notes                |
| -------------- | ---------------------------------------------- | -------------------- |
| `isOpen`       | `boolean`                                      | Visibility           |
| `title`        | `string`                                       | Heading              |
| `message`      | `string`                                       | Body copy            |
| `confirmText?` | `string`                                       | Confirm button label |
| `cancelText?`  | `string`                                       | Cancel button label  |
| `variant?`     | `'danger' \| 'warning' \| 'info' \| 'success'` | Color treatment      |
| `onConfirm`    | `() => void \| Promise<void>`                  | Confirm action       |
| `onCancel`     | `() => void`                                   | Dismiss action       |
| `children?`    | `ReactNode`                                    | Optional custom body |

```tsx
<ConfirmationDialog
  isOpen={open}
  title="Delete contact?"
  message="This cannot be undone."
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => setOpen(false)}
/>
```

### `FeedbackContainer.tsx`

Unified success/error/warning/info feedback region. Exposes a `Feedback`
type and a context (`FeedbackContextType`) so any component can surface a
toast-like message.

```ts
type Feedback = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
};
```

```tsx
const { showFeedback } = useFeedback(); // from FeedbackContext
showFeedback({ id: crypto.randomUUID(), type: 'success', message: 'Saved' });
```

### `FormWrapper.tsx`

Standard form shell built on `react-hook-form`. Handles submit, busy state,
and validation wiring so feature forms stay thin.

| Prop                  | Type                                    | Notes                          |
| --------------------- | --------------------------------------- | ------------------------------ |
| `onSubmit`            | `(data: T) => Promise<void> \| void`    | Submit handler                 |
| `defaultValues?`      | `T`                                     | Initial values                 |
| `children`            | `(form: UseFormReturn<T>) => ReactNode` | Render-prop with the form API  |
| `validationResolver?` | resolver                                | Optional `zod`/custom resolver |

```tsx
<FormWrapper<ContactForm> onSubmit={save} defaultValues={{ name: '' }}>
  {({ register, formState }) => <input {...register('name')} />}
</FormWrapper>
```

### `LoadingSpinner.tsx`

Standardized loading indicator. One spinner everywhere keeps motion/color
consistent.

| Prop          | Type                                            | Default     |
| ------------- | ----------------------------------------------- | ----------- |
| `size?`       | `'small' \| 'medium' \| 'large'`                | `'medium'`  |
| `color?`      | `'primary' \| 'secondary' \| 'white' \| 'gray'` | `'primary'` |
| `fullScreen?` | `boolean`                                       | `false`     |
| `text?`       | `string`                                        | —           |

### `EventHandlerWrapper.tsx`

Subscribes to a `uiBus` event and re-renders children when it fires. Prefer
this over scattering `window.addEventListener` calls.

| Prop            | Type                       | Notes                                        |
| --------------- | -------------------------- | -------------------------------------------- |
| `event`         | `string`                   | A `uiBus` event name (see `07-event-bus.md`) |
| `handler`       | `(...args: any[]) => void` | Invoked on emit                              |
| `dependencies?` | `any[]`                    | Effect deps                                  |
| `children?`     | `ReactNode`                | Optional content                             |

```tsx
<EventHandlerWrapper event="data:changed" handler={() => refetch()}>
  <EmailList />
</EventHandlerWrapper>
```

---

## Stability Hooks & Utils

### `useAsyncData.ts`

Standardized async fetch with `data / isLoading / error / refetch`. Kills the
boilerplate `useEffect + try/catch + setState` pattern.

```ts
const { data, isLoading, error, refetch } = useAsyncData(
  () => fetchThreads(accountId),
  [accountId],
);
```

### `useAsyncError.ts`

Normalizes thrown values (strings, `Error`, unknown) into `{ message }` for
consistent display.

### `useLoading.ts`

Boolean loading-state manager with `start / stop / toggle / isLoading`.

### `usePersistentState.ts`

`useState` mirror persisted to `localStorage` (default) or `sessionStorage`,
with cross-tab sync via the `storage` event. Gracefully no-ops if storage is
unavailable (e.g. private mode).

```ts
const [theme, setTheme] = usePersistentState<'light' | 'dark'>('ui-theme', 'light');
```

### `retryLogic.ts`

`withRetry(fn, opts)` — exponential backoff with jitter and configurable retry
conditions. Use for transient failures (network, IPC timeouts).

```ts
const result = await withRetry(() => invokeCommand('db_sync_now'), {
  retries: 3,
  baseDelayMs: 200,
  shouldRetry: (err) => !err.isFatal,
});
```

---

## Adoption Rule

Before adding a new spinner, dialog, retry block, or persistence hook inside a
feature:

1. Check this library.
2. If the primitive exists — import it.
3. If it's missing but generic — add it **here** (typed, strict, no `any`),
   then use it in the feature.

This keeps the UI consistent and the duplication low.

## Related

- [Reuse Patterns](../../05-DEVELOPMENT/05-reuse-patterns.md) — broader refactor catalog
- [Event Bus (uiBus)](07-event-bus.md) — `uiBus` event contract
- [State Management](02-state-management.md) — where state lives
