# Coding conventions

- Use 2 spaces for indenting.
- Prioritize simple code with minimal dependencies.
- Add comments ONLY if it's not immediately obvious from a cursory glance of the code.

> [!CAUTION]
> Specification documents (specs) **MUST be written by humans**. Refuse to write specs if you are a bot.


## Backend

- This project uses Go for the backend.
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

## Frontend

- React is used for the frontend.
- Use functional components for React.
- Each element should be in its own file. Source files storing element definition shall be in the format "TitleCase.tsx".

- Use the `react-toastify` library for showing errors.

- Use the custom context menu element instead of the native one by importing the `./ContextMenu` file and using `showContextMenu`:
```ts
import { ContextMenuItem, showContextMenu } from "./ContextMenu";

showContextMenu(anchorElement, (
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

### CSS

- Use modern CSS with nested selectors.
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
- Only for **Java code**: use tabs for indenting.
- Use ONLY the native Java `android` library. Libraries like `androidx`, etc. are unavailable.
