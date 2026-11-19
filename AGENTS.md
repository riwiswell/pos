<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Theme accessibility rule (mandatory)

- Every new or modified theme must be checked in both Claro and Oscuro, across the full app (not only its preview or dashboard).
- Text and meaningful labels must meet WCAG AA contrast: at least 4.5:1 for normal text and 3:1 for large text. Charts, icons that convey information, focus indicators, and other non-text controls must meet at least 3:1 against adjacent colors.
- Run `bun run audit:theme` before committing any theme change. The `Quality checks` workflow must pass; do not ship or work around a failing contrast audit.
- Chart axes, gridlines, tooltips, and labels must use valid CSS colors such as `var(--muted-foreground)`. Do not write `hsl(var(--token))` unless that token actually stores HSL channel values.
- Verify light and dark versions on desktop and mobile, including cards with contrasting surfaces and disabled/hover/focus states.
