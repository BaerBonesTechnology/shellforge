# ShellForge (Dart)

A command-line workflow automation tool that lets you create, manage, and run reusable command sequences across Bash, Zsh, PowerShell, and CMD.

Dart/pub.dev port of [ShellForge](https://www.npmjs.com/package/shellforge).

## Installation

```bash
dart pub global activate shellforge
```

This makes the `forge` command available globally.

## Quick Start

```bash
# 1. Initialize — pick your shell and storage location
forge init

# 2. Create a script — the interactive builder walks you through it
forge create

# 3. Run it
forge run fl-create demo --platforms=ios,android
```

See the [full documentation](https://github.com/BaerBonesTechnology/shellforge) for parameter syntax and all commands.
