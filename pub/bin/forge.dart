import 'dart:io';
import 'package:args/args.dart';
import 'package:shellforge/src/commands.dart';
import 'package:shellforge/src/config.dart';
import 'package:shellforge/src/constants.dart';
import 'package:shellforge/src/prettify.dart';

void main(List<String> arguments) async {
  final parser = ArgParser();

  parser.addCommand('init');
  parser.addCommand('create');
  parser.addCommand('list');
  final runCmd = parser.addCommand('run');
  parser.addCommand('delete');
  final editCmd = parser.addCommand('edit');
  parser.addCommand('reinit');
  parser.addCommand('clear');
  parser.addCommand('update');
  parser.addCommand('default');
  parser.addCommand('config');
  final newsCmd = parser.addCommand('news');
  parser.addCommand('help');

  runCmd.allowsAnything;

  editCmd.addOption('openCommand', abbr: 'o', help: 'Editor command name');
  editCmd.addOption('path', abbr: 'p', help: 'Editor executable path');

  newsCmd.addOption('versionChoice',
      abbr: 'v', defaultsTo: AnnouncementFilter.list, help: 'Version to view');

  ArgResults results;
  try {
    results = parser.parse(arguments);
  } catch (e) {
    print(Prettify.error('$e'));
    _printUsage();
    exit(1);
  }

  final command = results.command;
  if (command == null) {
    _printUsage();
    exit(0);
  }

  switch (command.name) {
    case 'init':
      await initialize();
      break;
    case 'create':
      await createScriptWithPrompt();
      break;
    case 'list':
      await listScripts();
      break;
    case 'run':
      final runArgs = arguments.sublist(1);
      if (runArgs.isEmpty) {
        print(Prettify.error('Usage: forge run <scriptName> [positionalArgs] [--flags]'));
        exit(1);
      }
      final scriptName = runArgs[0];
      final rest = runArgs.sublist(1);

      final positional = <String>[];
      final named = <String, String>{};
      var i = 0;
      while (i < rest.length) {
        final arg = rest[i];
        if (arg.startsWith('--')) {
          if (arg.contains('=')) {
            final eqIdx = arg.indexOf('=');
            named[arg.substring(2, eqIdx)] = arg.substring(eqIdx + 1);
          } else if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
            named[arg.substring(2)] = rest[i + 1];
            i++;
          } else {
            named[arg.substring(2)] = 'true';
          }
        } else if (arg.startsWith('-') && arg.length == 2) {
          if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
            named[arg.substring(1)] = rest[i + 1];
            i++;
          } else {
            named[arg.substring(1)] = 'true';
          }
        } else {
          positional.add(arg);
        }
        i++;
      }
      await runScript(scriptName,
          cliArgs: named, positionalArgs: positional);
      break;
    case 'delete':
      if (command.rest.isEmpty) {
        print(Prettify.error('Usage: forge delete <scriptName>'));
        exit(1);
      }
      await deleteScript(command.rest[0]);
      break;
    case 'edit':
      if (command.rest.isEmpty) {
        print(Prettify.error('Usage: forge edit <scriptName>'));
        exit(1);
      }
      await openScriptForEditing(
        command.rest[0],
        openCommand: command['openCommand'] as String?,
        editorPath: command['path'] as String?,
      );
      break;
    case 'reinit':
      await reinitialize();
      break;
    case 'clear':
      await clearScripts();
      break;
    case 'update':
      print('To update, run: dart pub global activate shellforge');
      break;
    case 'default':
      await resetConfig();
      break;
    case 'config':
      await viewConfig();
      break;
    case 'news':
      await announcements(
          versionChoice: command['versionChoice'] as String?);
      break;
    case 'help':
      _printUsage();
      break;
    default:
      _printUsage();
  }
}

void _printUsage() {
  print('''
ShellForge v$currentVersion — Workflow automation CLI

Usage: forge <command> [arguments]

Commands:
  init                    First-time setup
  create                  Build a new script interactively
  list                    List all saved scripts
  run <name> [args]       Run a script by name
  edit <name>             Open a script in your editor
  delete <name>           Delete a script
  clear                   Delete all scripts
  reinit                  Re-initialize (move or delete scripts)
  default                 Reset config to defaults
  config                  View current configuration
  news                    View version announcements
  help                    Show this help

Run "forge run <name> --help" for parameter info.
''');
}
