# ShellForge

A command-line workflow automation tool that lets you create, manage, and run reusable command sequences across Bash, Zsh, PowerShell, and CMD.

## Packages

| Package | Platform | Install |
|---------|----------|---------|
| [npm](npm/) | Node.js | `npm install -g shellforge` |
| [pub](pub/) | Dart | `dart pub global activate shellforge` |

## Quick Start

```bash
forge init              # First-time setup
forge create            # Build a new script interactively
forge run <name> [args] # Run a script by name
forge list              # List all saved scripts
forge help              # Show all commands
```

## Repository Structure

```
shellforge/
├── npm/    # Node.js package (npmjs.com)
└── pub/    # Dart package (pub.dev)
```

See each package's README for full documentation, parameter syntax, and configuration details.

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

## License

MIT — see [LICENSE](LICENSE) for details.

## Script Parameters

When creating a script, the command builder walks you through adding parameters to each command. Parameters are resolved at runtime — from positional args, CLI flags, or interactive prompts.

### Syntax

| Syntax | Type | Behavior when not provided |
|--------|------|---------------------------|
| `{name}` | **Required** | Filled by positional arg or prompted |
| `?{name}` | **Nullable** | Silently removed (replaced with empty string) |
| `{name=>default}` | **Optional** | Uses the default value |

Flag-style parameters (prefixed with `--` or `-`) auto-insert `=` between the flag and value in the output:

| Syntax | Type | Output |
|--------|------|--------|
| `{--org=>com.example}` | **Optional flag** | `--org=com.example` |
| `?{--platforms}` | **Nullable flag** | `--platforms=value` or removed entirely |

### Example

A script built with the command builder:

```
flutter create {name} {--org=>com.example} ?{--platforms}
```

Run it — positional args map to non-flag required params, flags resolve named params:

```bash
forge run fl-create myapp --platforms=ios,android
# → flutter create myapp --org=com.example --platforms=ios,android
```

Override the default for `--org`:

```bash
forge run fl-create myapp --org=com.custom --platforms=ios
# → flutter create myapp --org=com.custom --platforms=ios
```

If required params aren't provided via positional args or flags, you'll be prompted interactively:

```bash
forge run fl-create
# > This script requires parameter(s): {name}
# > Enter value for {name}: myapp
# → flutter create myapp --org=com.example
```

## Editing Scripts

```bash
forge edit <scriptName>
```

By default this opens in VS Code (`code`). To change the editor:

```bash
# Set editor by command name (must be in PATH)
forge edit my-script --openCommand subl

# Set editor by absolute path
forge edit my-script --path "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl"
```

Your choice is saved for future use.

## Configuration

ShellForge stores its configuration in `~/.shellforge/config.json`. This includes:

- **terminalProfile** — `bash`, `zsh`, `powershell`, or `cmd`
- **scriptDir** — where script data is stored (default: `~/.scripts`)
- **defaultTextEditorCommand** — editor command for `forge edit`

View the current config with:

```bash
forge config
```

## Announcements

Stay up to date with what's new:

```bash
# Interactive version picker
forge news

# Specific version
forge news --versionChoice 0.0.45

# All announcements
forge news --versionChoice ALL
```

## What's New in v0.0.41

- **Interactive command builder** — `forge create` now walks you through building commands step-by-step with typed parameters
- **New parameter separator** — `=>` replaces `==` for optional defaults: `{param=>default}`
- **Flag-style parameters** — Use `{--org=>com.example}` or `?{--platforms}` with auto `=` insertion in output
- **Positional arguments** — `forge run script value` maps positional values to non-flag required params in order
- **Interactive script execution** — Scripts now support stdin pass-through for commands that expect user input
- **Config moved to home directory** — No longer writes to the installed package; lives in `~/.shellforge/`
- **Improved version comparison** — Numeric comparison instead of string-based
- **Bug fixes** — Fixed editor command, ESM compatibility, shell injection hardening, and more

## Contributing

Contributions, bug reports, and feature suggestions are welcome. Visit the [GitHub repository](https://github.com/BaerBonesTechnology/shellforge) for more details.

## License

MIT — see [LICENSE](LICENSE) for details.