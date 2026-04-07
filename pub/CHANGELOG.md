## 0.0.41

- Initial Dart port of ShellForge
- Interactive command builder with typed parameters
- Parameter syntax: `{name}` (required), `?{name}` (nullable), `{name=>default}` (optional)
- Flag-style parameters with auto `=` insertion (`{--org=>com.example}`)
- Positional argument mapping for `forge run`
- Cross-shell support: Bash, Zsh, PowerShell, CMD
- Config stored in `~/.shellforge/`
