# Ynot Body Mist — pre-launch site

Single-page site for **Ynot Body Mist**. Four scents, one attitude: choosing a vibe
recolours the whole page.

## What's here

| File | What it is |
|---|---|
| `index.html` | The entire site. No build step, no dependencies — the bottle photos and the wordmark are embedded in the file itself. |
| `og-image.jpg` | Social preview card, used when the link is shared. |

## Where it's live

- **https://ynot-body-mist.vercel.app** — primary (Vercel, auto-deploys on every push to `main`)
- **https://amanchhabra-ux.github.io/ynot-body-mist/** — mirror (GitHub Pages, same branch)

Push to `main` and both update. Vercel takes a few seconds; Pages takes about a minute.

## Original GitHub Pages setup

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch** → branch `main`, folder `/ (root)` → **Save**
3. Wait a minute, then open `https://amanchhabra-ux.github.io/ynot-body-mist/`

## Pre-orders

The **Reserve my bottle** button opens the visitor's own mail app with the order
written out — vibe, quantity, MRP total, and blank lines for name, phone and address —
addressed to `gaurichhabra272012@gmail.com`. Nothing is charged on the page and no
third-party service handles the data.

To change where orders go, edit one line in `index.html`:

```js
var TO = 'gaurichhabra272012@gmail.com', PRICE = 599, qty = 1;
```

`PRICE` is the per-bottle MRP in rupees — change it there and the totals follow.

## Editing content

Scents, colours and copy all live in one array near the bottom of `index.html`:

```js
var VIBES = [
  {id:'black_bloom', name:'Black Bloom', notes:'Floral. Elegant. Unforgettable.', ...},
  ...
];
```

Change a `name`, `notes`, `line` or `when` string and the hero, the lineup panels and
the pre-order mail all update together.
