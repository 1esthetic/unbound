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
