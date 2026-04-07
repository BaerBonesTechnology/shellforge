# ShellForge

A command-line workflow automation tool that lets you create, manage, and run reusable command sequences across Bash, Zsh, PowerShell, and CMD.

## Installation

```bash
npm install -g shellforge
```

This makes the `forge` command available globally.

## Quick Start

```bash
# 1. Initialize — pick your shell and storage location
forge init

# 2. Create a script
forge create
#    Script name: deploy
#    Path: /home/user/my-project
#    Commands: git add ., git commit -m "{message}", git push origin {branch==main},

# 3. Run it
forge run deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `forge init` | First-time setup — choose terminal profile and script directory |
| `forge create` | Interactively create a new script |
| `forge list` | List all saved scripts |
| `forge run <scriptName>` | Run a script by name |
| `forge edit <scriptName>` | Open a script in your editor |
| `forge delete <scriptName>` | Delete a script |
| `forge clear` | Delete all scripts |
| `forge reinit` | Re-initialize (move or delete existing scripts) |
| `forge update` | Update CLI and regenerate scripts |
| `forge default` | Reset config to defaults |
| `forge config` | View current configuration |
| `forge news` | View version announcements |
| `forge help` | Show help |

## Script Parameters

When creating a script, you can use parameter placeholders in your commands. These are resolved at runtime — either from CLI flags or interactive prompts.

### Syntax

| Syntax | Type | Behavior when not provided |
|--------|------|---------------------------|
| `{name}` | **Required** | User is prompted to enter a value |
| `?{name}` | **Nullable** | Silently removed (replaced with empty string) |
| `{name==default}` | **Optional** | Uses the default value |

### Example

Create a script with parameters:

```
Enter the commands to run:
git add ., git commit -m "{message}", git push ?{remote} {branch==main},
```

Run it — parameters are prompted interactively:

```bash
forge run deploy
# > This script requires parameter(s): {message}
# > Enter value for {message}: fix typo
# ?{remote} is removed, {branch==main} defaults to "main"
```

Or pass values via flags to skip prompts:

```bash
forge run deploy --message "fix typo" --remote origin --branch dev
```

You can mix both — pass some flags and get prompted for the rest.

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
forge news --versionChoice 0.0.2

# All announcements
forge news --versionChoice ALL
```

## What's New in v0.0.2

- **Script parameters** — Use `{param}`, `?{param}`, and `{param==default}` syntax for dynamic scripts
- **Interactive script execution** — Scripts now support stdin pass-through for commands that expect user input
- **Config moved to home directory** — No longer writes to the installed package; lives in `~/.shellforge/`
- **Improved version comparison** — Numeric comparison instead of string-based
- **Bug fixes** — Fixed editor command, ESM compatibility, shell injection hardening, and more

## Contributing

Contributions, bug reports, and feature suggestions are welcome. Visit the [GitHub repository](https://github.com/BaerBonesTechnology/shellforge) for more details.

## License

MIT — see [LICENSE](LICENSE) for details.