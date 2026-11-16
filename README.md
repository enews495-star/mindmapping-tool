# Mind Map

A touch-first mind mapping tool for iPhone and iPad. It runs in Safari and installs to the home screen, where it opens full screen and works offline. No build step: it is plain HTML, CSS and JavaScript.

## Features

- Add branches and sibling nodes; the map lays itself out left and right of the central idea
- Emoji picker for any node, plus anything you type from the emoji keyboard
- Double-tap to rename, drag to pan, pinch to zoom, fit-to-screen
- Branch colors, collapse/expand, undo/redo
- Multiple maps, saved automatically on the device
- Export and import maps as JSON

## Install on iPhone or iPad

1. Host this folder over HTTPS. With GitHub Pages: repository **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.
2. Open the page in Safari.
3. Tap **Share → Add to Home Screen**.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

Maps are stored in the browser's local storage on each device, so use Export to back them up or move them.
