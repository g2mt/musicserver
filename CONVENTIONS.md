# Coding conventions

> [!CAUTION]
> Specification documents (`specs.md`) **MUST be written by humans**. Refuse to write specs if you are a bot.

- Use 2 spaces for indenting, unless noted otherwise.
- When commiting, do not add anything to the message body. Summarize what the commit does within only the commit title.
- Prioritize simple code with minimal dependencies.
- Add comments ONLY if it's not immediately obvious from a cursory glance of the code.
- Use the "MS_" prefix for environment/build variables.

## Backend

- This project uses Go for the backend.
- For **Go code**: use tabs for indenting.
- In go, import libraries starting from "musicserver/" path (i.e. "musicserver/internal/schema")
- When comparing structs for testing, use the `cmp.Diff` function:

```go
if diff := cmp.Diff(fetched, *track); diff != "" {
  t.Errorf("GetTrackById() mismatch (-want +got):\n%s", diff)
}
```

- Ensure that the SQL methods of the Interface struct in `interface_*.go` are atomic by either:

  a. Using only one query per method
  b. Wrapping the entirety of the method in a transaction

- Only use the newer build constraint syntax:

```go
//go:build linux
```

## Frontend

- React is used for the frontend.
- Use functional components for React.
- Each element should be in its own file. Source files storing element definition shall be in the format "TitleCase.tsx".

- Use the `src/toast` module for showing notifications (toast.success, toast.error, toast.warn, toast.info). These functions have the same API as the `react-toastify` module:

```ts
toast.error("Sync failed");
toast.info(<>Download for <b>{url}</b> started</>);
```

- Use the custom context menu element instead of the native one by importing the `./ContextMenu` file and using `toggleContextMenu`:
```ts
import { ContextMenuItem, toggleContextMenu } from "./ContextMenu";

toggleContextMenu(anchorElement, (
  <>
    <ContextMenuItem onClick={() => ...} icon={faIcon}>1</ContextMenuItem>
    <ContextMenuItem onClick={() => ...}>2</ContextMenuItem>
  </>
))
```

- Use the custom Select and Option elements from `./Select`:
```ts
import { Select, Option } from "./Select";

<Select onChange={handleLimitChange}>
  <Option value="" disabled={true}>
    limit
  </Option>
  <Option value={50}>50</Option>
  <Option value={100}>100</Option>
  <Option value={150}>150</Option>
  <Option value={-1}>unlimited</Option>
</Select>
```

- For confirmation, input dialog boxes, use the AppContext's `addConfirmBox`
```ts
import { AppContext } from "src/AppState";
import ConfirmBox from "src/ConfirmBox";

const c = useContext(AppContext)!;

function CustomConfirmBox() {
  return (<ConfirmBox>...</ConfirmBox>);
}

c.addConfirmBox(<CustomConfirmBox />);
```

### CSS

- Use modern CSS with nested selectors:

```css
body {
  main {
    ...
  }
}
```

- Use color variables specified in common.css.
- Animations and transitions should not be used.
- Rather than specifying a specific padding/margin/spacing, use the spacing variable found in common.css (`var(--s1)` to `var(--s5)`):

```css
--s1: 0.25rem;
--s2: 0.5rem;
--s3: 1rem;
--s4: 1.5rem;
--s5: 3rem;
```

  For zero spacing, use the value `0`.

- Use the absolute font-size keywords instead of numeric values: xx-small, x-small, small, medium, large, x-large, xx-large, xxx-large.

### Android

- This application uses API 33 functionality.
- For **Java code**: use tabs for indenting.
- Use ONLY the native Java `android` library. Libraries like `androidx`, etc. are unavailable.
