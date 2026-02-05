# hooks/

Custom React hooks.

## Files

| File | Description |
|------|-------------|
| `useLocalStorage.ts` | localStorage state hook with cross-tab sync, serialization, and SSR safety. Also exports `readLocalStorageValue` for reading outside React. Supports custom serializers and `getInitialValueInEffect` option. |
| `useDebounce.ts` | Debounce hook for delaying value updates |
| `useWindowEvent.ts` | Window event listener hook with automatic cleanup |
| `index.ts` | Re-exports all hooks |

## Usage

```ts
import { useLocalStorage } from "@aidbox-ui/hooks";

const [value, setValue, removeValue] = useLocalStorage<string>({
  key: "my-key",
  defaultValue: "default",
  getInitialValueInEffect: false, // read from storage immediately (not in useEffect)
});
```
