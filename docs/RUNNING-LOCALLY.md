# Running the portal locally

```
npm install
npm run dev
```

Then open **http://localhost:3000/east-ponds/move-in** — the resident's entry
point. `/` is a demo index for us; a resident never sees it.

The portal is mobile-first at `max-width: 430px`. Narrow the window or use a
device emulator, or it looks stranded in the middle of a laptop screen.

## Opening it from your phone

Use your machine's LAN address — `http://192.168.x.x:3000/east-ponds/move-in`.

**This requires `allowedDevOrigins`, which is already set in `next.config.ts`.**
Next 16 blocks cross-origin requests to `/_next/*` by default and returns 403.
The page still server-renders, so it looks fine — but no JavaScript loads,
nothing hydrates, typed input doesn't format and buttons never enable. It
presents as a broken form rather than a blocked request.

Private ranges (`192.168.*.*`, `10.*.*.*`, `172.16.*.*`, `*.local`) are allowed
by default. Override with `NEXT_DEV_ORIGINS=host1,host2`.

**How to tell you've hit it:** the dev server logs `Blocked cross-origin request
to Next.js dev resource /_next/...`, and the browser console shows 403s on
`/_next/static/chunks/*`.

## When a change doesn't appear

Next's dev server does not reliably hot-reload `:root` / `@theme` changes in
`globals.css`, and Tailwind v4 caches compiled CSS under `.next`:

```
# Ctrl-C, then
rm -rf .next && npm run dev
```

Then hard-reload (Cmd-Shift-R). The quickest check that you are on current
code: the amber **Demo** bar at the top of every property page. It renders only
while the app is on mock data.

## Known environment quirk

`next build` segfaults ("Bus error") inside the Cowork sandbox VM when the repo
sits on the mounted filesystem. It builds fine on macOS directly. If you hit it,
`NEXT_DIST_DIR=$HOME/.gatecard-next npm run build` moves build output off the
mount.
