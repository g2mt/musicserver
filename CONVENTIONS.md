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

### CSS

- Use modern CSS with nested selectors.
