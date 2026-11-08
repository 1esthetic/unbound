---
banner: media/banner.png
gallery:
  - image: media/02-selected-three.png
    alt: 'A DM with three messages highlighted and a toast reading "Selected: 3" with Delete and Done buttons.'
  - image: media/03-delete-confirm.png
    alt: A confirmation dialog reading "Delete 3 messages?" and "This cannot be undone", with a red Delete button and Cancel.
  - image: media/01-actions-sheet.png
    alt: The long-press menu on a message, showing Select message and Select range from here above Reply and Forward.
---

Select several messages at once instead of opening each one, then delete them together.

## Selecting

Long-press a message and pick **Select message**, or **Select range from here** to take everything up to the next message you tap. While selection mode is on, a single tap selects or deselects any message, and a toast at the top counts what you have so far.

## Deleting

Press **Delete** in the toast. A confirmation tells you exactly how many messages will go, and deleting starts only after you accept it. A progress toast counts the messages as they are removed, and messages Discord refuses to delete, such as ones older than your permission allows, are counted separately instead of stopping the run.

## Details

- Leaving the channel clears the selection, so a delete can never target messages you are no longer looking at.
- Selected rows are highlighted natively, the same way Discord highlights a message you long-press.
- Deleting is rate-limited by Discord; larger selections take a moment and show progress while they run.
- iPhone and iPad only.
