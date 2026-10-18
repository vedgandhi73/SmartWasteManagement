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

- Points, report status changes and redemptions happen only in server functions (src/lib/waste.functions.ts) using the admin client; tables are read-only to users so points can't be faked.
- AI photo checks run server-side in src/lib/ai.server.ts via Lovable AI; rule values live in src/lib/points.ts (covered by src/test/points.test.ts).
