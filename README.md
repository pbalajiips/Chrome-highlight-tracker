# Simple Highlight Tracker

A Chrome Extension that allows you to highlight text on any webpage and track it for later review.

## Features

- **Highlight Text**: Select text on any webpage to highlight it in yellow.
- **Persistence**: Highlights are saved and automatically restored when you revisit the page.
- **Popup Manager**: View a list of all your saved highlights, including the date and source URL.
- **Pause/Resume**: Temporarily disable highlighting without uninstalling the extension.
- **Backup & Restore**: Download all your highlight data to a file and restore it later.
- **History Management**: Clear all saved highlights with a single click.

## Installation

1.  Clone or download this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click the **Load unpacked** button in the top left.
5.  Select the `highlight-tracker` folder from this repository.

## Usage

1.  **Highlighting**:
    - Navigate to any website.
    - Select text with your mouse.
    - The text will automatically turn yellow and be saved to your list.

2.  **Viewing Highlights**:
    - Click the extension icon in the Chrome toolbar.
    - A popup will appear showing your history of highlights.
    - Click "Source" to revisit the page where the text was found.

3.  **Controls**:
    - **Pause Tracking**: Click the "Pause Tracking" button in the popup to stop saving new highlights.
    - **Clear History**: Click "Clear History" to remove all saved data.