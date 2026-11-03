# Changelog

## 0.5.1

### Changed

- Internal cleanup: one shared hook loads the catalog for the tab, the dashboard view and the card; typed dashboard slot component; unused strings removed; README describes where the plugin appears.

## 0.5.0

### Added

- Applications joins the Dashboard switcher ("Dashboard | Applications"), like the Homepage plugin: the catalog shows inside the dashboard, with a copy link (`/apps`) and an open full view action.

### Removed

- The sidebar icon. The catalog opens from the dashboard switcher, the dashboard card, the command palette or `/apps`.

## 0.4.1

### Added

- Opening `/apps` loads the normal Termix shell and opens the catalog tab, as if the rail icon was clicked.
- The rail icon is back and opens the catalog tab directly.

### Removed

- The full-screen `?view=applications` page.

## 0.4.0

### Added

- Dashboard card with the applications as links and a button to open the catalog.
- Full-screen page at `/?view=applications`, and a command palette entry, taking the place of the Homepage plugin.

### Changed

- Removed the sidebar icon and panel. The catalog is a single tab, opened from the palette or the dashboard card.
- Import from devhub and scan for suggestions are back in the catalog toolbar.

## 0.3.2

### Changed

- Showing the sidebar panel also opens the catalog tab, so the rail icon brings up both as before.

## 0.3.1

### Changed

- The sidebar panel now follows the Hosts panel: header with open-in-tab and refresh, search, an icon row (import, scan) with an Add button, and rows with open, edit and delete actions.
- Add, edit and review of a suggestion share one form, in the panel and in the catalog tab.

## 0.3.0

### Added

- Sidebar panel on the rail icon, like Sessions: quick add form, import from devhub, scan for suggestions (a suggestion fills the form as a draft) and the list of applications, with a button that opens the catalog.

### Changed

- The catalog tab is now only the grid/list with search, add, edit and delete; import and suggestions moved to the panel.
- The tab shows only its icon, with no title text.
- Panel and tab refresh each other after any change.

## 0.2.0

### Changed

- Rebuilt the tab with Termix's own components: panel header, search, grid/list toggle and in-place form, so it follows the active theme.
- Cards take the old hub's layout (initials tile, description, host) in Termix's flat style.
- Add, scan for suggestions and import now sit in the toolbar as icon buttons; edit and delete are icon actions with a confirmation.
- Suggestions list the source as a badge and open the same form for review.
- Interface text moved to locales (English).

## 0.1.0

### Added

- Shared application catalog with configurable links.
