# Contributing

Thanks for taking an interest in Canned Response Archive.

The project is intentionally small: saving a reply, finding it through a shortcut, and inserting or copying it should always be quick. Changes that make that workflow clearer, more accessible, or more reliable are welcome.

## Before you start

Open an issue describing the problem or proposed improvement. For security issues, use the private reporting guidance in [SECURITY.md](SECURITY.md) instead of a public issue.

Please avoid including real account information, customer messages, API keys, or copyrighted image files in sample issues or pull requests.

## Working locally

```bash
npm ci
npm run dev
npm run check
```

See [docs/setup.md](docs/setup.md) for local Worker and database configuration. Use a separate development Supabase project and placeholder messages for testing.

## A good pull request

- Explain the problem and the behavior that changed.
- Keep permissions on the **server**. Hiding a button is not an authorization check.
- Preserve the quick `#` search, shared/private boundaries, keyboard support, and light/dark liquid-glass interface unless the change explicitly targets them.
- Include tests for bug fixes or permissions-sensitive paths.
- Keep animation responsive and respect reduced-motion and lower-capability devices.
- Update the appropriate documentation when features or setup change.
- Use `npm ci` and run `npm run check`; commit any intentional npm lockfile changes and describe manual testing.

Avoid silently importing third-party artwork into the repository: include its source and usage rights, and prefer licensed or clearly permitted assets.

This is an evolving project rather than a polished framework; small, focused improvements are easier to review and maintain.
