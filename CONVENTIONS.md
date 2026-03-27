# Coding conventions

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

## Frontend

- React is used for the frontend.
- Use functional components for React.
- Each element should be in its own file. Source files storing element definition shall be in the format "TitleCase.tsx".
- Use the `react-toastify` library for showing errors.

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
