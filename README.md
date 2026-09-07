# Money Flow - 50/30/20 Finance Dashboard

A responsive static web dashboard for personal budgeting with the 50/30/20 rule.

![Dashboard preview](preview.png)

## Included features

- Monthly income, expenses, savings, and remaining balance KPIs
- Target-versus-actual 50/30/20 analysis
- Allocation donut and comparison chart without external libraries
- Add, edit, delete, search, and filter transactions
- Twelve-month summary and savings-rate trend
- Editable ratios, categories, and payment methods
- Automatic browser saving with `localStorage`
- JSON backup/restore, CSV export, and print/PDF layout
- Responsive layout for desktop, tablet, and mobile
- No build command, package manager, database, or external CDN required

## Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and the `/(root)` folder, then save.
6. Open the GitHub Pages address shown by GitHub after deployment.

Official documentation:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Data storage and privacy

This project is a static website. Transaction data is stored only in the current browser through `localStorage`; it is not written to the GitHub repository and does not automatically synchronize between devices or browsers.

Use **Backup JSON** before changing device, clearing browser data, or using private browsing. Use **Restore JSON** to load the backup on another browser.

## Files

- `index.html` - application shell
- `assets/css/styles.css` - responsive user interface
- `assets/js/seed.js` - default categories and sample data from the original workbook
- `assets/js/app.js` - calculations, charts, storage, import/export, and interactions
- `.nojekyll` - tells GitHub Pages to serve the static files directly

## Local use

The dashboard can usually be opened directly by double-clicking `index.html`. A local server is also supported:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.
