# Unbound addons

Plugins and a theme for [Unbound](https://unbound.rip), the Discord client mod for iOS and Android.

| Addon | Kind | Platform | What it does |
| --- | --- | --- | --- |
| [Multi Select](multi-select) | Plugin | iOS | Select several messages by tapping them, then delete them together. |
| [Swipe Reply](swipe-to-reply) | Plugin | iOS, Android | Makes swiping any message reply to it, including your own. |
| [Nocturne Native](nocturne-native) | Plugin | iOS | Recolours the native swipe-to-reply indicator to match the Nocturne theme. |
| [Nocturne](themes/1esthetic.nocturne) | Theme | iOS, Android | Neutral dark palette with no blue tint, a little darker than Discord's Darker. |

## Building

The workspace is described by `unbound.config.json`; every addon builds into its own `dist/` folder.

```sh
bunx --bun @unbound-app/cli build   # build every addon once
bunx --bun @unbound-app/cli dev     # rebuild and hot reload on change
```

`dist/` is committed on purpose: Unbound's store reads the built bundle and manifest from the
repository, so the output has to be there.

## Trying an addon on a device

```sh
bunx --bun @unbound-app/cli push 1esthetic.multi-select
bunx --bun @unbound-app/cli install 1esthetic.swipe-to-reply --restart
```

## Publishing

```sh
bunx --bun @unbound-app/cli login
bunx --bun @unbound-app/cli publish --addon 1esthetic.multi-select
```

`publish` submits the committed and pushed addon for review. It refuses a directory with
uncommitted changes, so build, commit and push first. Every release needs a higher `version` in
the addon's `manifest.json` and an entry for it in the addon's `CHANGELOG.md`.

## About

These plugins started as my own fix for a few things that felt clunky in Discord. I wanted
my setup to be nicer, and it seemed worth sharing in case it helps someone else too.

How they came together:

- I came up with the ideas, the behaviour and the visual design.
- I used an AI coding assistant to write the code based on those decisions and to suggest
  implementation options along the way.
- I tuned the behaviour, tested and debugged them on a device, and made the final calls on
  how everything works.

I write this openly so that anyone using the plugins, or reading the source, knows exactly
how they were made. And the result is mine to answer for: I maintain it, handle releases
and review responses, and fix what breaks.

I hope these plugins make Unbound a little more convenient :)

