---
banner: media/banner.png
gallery:
  - image: media/01-swipe-indicator.png
    alt: A message being swiped in a DM, with the reply indicator in the theme's beige accent instead of Discord's blurple.
---

The companion to the [Nocturne](https://unbound.rip/addons/1esthetic.nocturne) theme.

Discord draws the swipe-to-reply indicator in native code, so a theme, which is only data, cannot recolour it. This plugin catches the colour before it is set: the reply circle takes the theme accent `#7d7569` and the background behind the swipe takes the chat colour `#121212`.

## Details

- Only paints while Nocturne is the applied theme; with another theme or in light mode it leaves Discord's colours alone.
- No settings.
- Nothing changes if Nocturne is not installed, so it is safe to keep enabled.
- iPhone and iPad only.
