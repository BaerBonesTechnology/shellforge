import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

import 'constants.dart';

const String currentVersion = '0.0.41';

final Map<String, dynamic> defaultConfig = {
  ConfigKey.announcements: [
    {
      ContentKey.version: currentVersion,
      ContentKey.messages: [
        'Welcome and thank you for using ShellForge! Run `forge help` to see all commands.',
        'Tips:\n- `forge create` to build a new script\n- `forge run <name>` to run it\n- Scripts stored in ~/.scripts by default',
      ],
    }
  ],
  ConfigKey.defaultTextEditorCommand: Defaults.editor,
  ConfigKey.defaultTextEditorPath: null,
  ConfigKey.scriptDir: '~/${Defaults.scriptDirName}',
  ConfigKey.scriptCommandDir: '~/${Defaults.scriptDirName}/${Defaults.commandsDirName}',
  ConfigKey.scriptFileName: Defaults.scriptsFile,
  ConfigKey.defaultScriptPath: Defaults.scriptPath,
  ConfigKey.terminalProfile: Shell.platformDefault,
  ConfigKey.initialized: false,
  ConfigKey.initMessages: [
    'Thank you for using ShellForge.\nIf this is your first time, run through the tutorial during init!',
  ],
  ConfigKey.tutorial: {
    ContentKey.steps: [
      {
        ContentKey.title: 'Welcome to ShellForge',
        ContentKey.message:
            'ShellForge lets you create and run reusable command sequences. Would you like a quick tutorial?',
      },
      {
        ContentKey.title: 'Initialization',
        ContentKey.message:
            'First, pick your shell and where scripts are stored.\n\nLet\'s do it!\n',
      },
      {
        ContentKey.title: 'Creating a new script',
        ContentKey.message:
            'Now let\'s create a script. The builder will walk you through it step by step.',
        ContentKey.subSteps: [
          {
            ContentKey.output:
                'Name the script, choose where it runs from, then add commands with parameters.',
            ContentKey.finished:
                'You\'ve created your first script! Run it with `forge run <name>`.\nUse `forge help` to see everything else.',
          }
        ],
      },
    ],
  },
};

final String _userConfigDir =
    p.join(Platform.environment[EnvVar.home] ?? Platform.environment[EnvVar.userProfile] ?? Defaults.homeFallback, Defaults.configDirName);
final String _configFile = p.join(_userConfigDir, Defaults.configFile);

String resolveTilde(String path) {
  final home = Platform.environment[EnvVar.home] ??
      Platform.environment[EnvVar.userProfile] ??
      Defaults.homeFallback;
  if (path == '~' || path.startsWith('~/') || path.startsWith('~\\')) {
    path = p.join(home, path.substring(1));
  }
  path = path.replaceAll(RegExp(r'\$HOME\b'), home);
  path = path.replaceAll(RegExp(r'%USERPROFILE%', caseSensitive: false), home);
  return path;
}

Future<Map<String, dynamic>> loadConfig() async {
  final file = File(_configFile);
  if (!file.existsSync()) {
    await Directory(_userConfigDir).create(recursive: true);
    await file.writeAsString(
        const JsonEncoder.withIndent('  ').convert(defaultConfig));
  }
  final data = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
  if (data[ConfigKey.scriptDir] is String) {
    data[ConfigKey.scriptDir] = resolveTilde(data[ConfigKey.scriptDir] as String);
  }
  if (data[ConfigKey.scriptCommandDir] is String) {
    data[ConfigKey.scriptCommandDir] =
        resolveTilde(data[ConfigKey.scriptCommandDir] as String);
  }
  return data;
}

Future<void> saveConfig(Map<String, dynamic> config) async {
  await Directory(_userConfigDir).create(recursive: true);
  await File(_configFile)
      .writeAsString(const JsonEncoder.withIndent('  ').convert(config));
}

Future<List<Map<String, dynamic>>> loadScripts() async {
  try {
    final config = await loadConfig();
    final scriptsFile =
        p.join(config[ConfigKey.scriptDir] as String, Defaults.scriptsFile);
    final file = File(scriptsFile);
    if (!file.existsSync()) return [];
    final list = jsonDecode(await file.readAsString()) as List;
    return list.cast<Map<String, dynamic>>().map((s) {
      if (s[ScriptKey.path] is String) s[ScriptKey.path] = resolveTilde(s[ScriptKey.path] as String);
      if (s[ScriptKey.script] is String) {
        s[ScriptKey.script] = resolveTilde(s[ScriptKey.script] as String);
      }
      return s;
    }).toList();
  } catch (e) {
    stderr.writeln('Error loading scripts: $e');
    return [];
  }
}

Future<void> saveScripts(List<Map<String, dynamic>> scripts) async {
  final config = await loadConfig();
  final scriptsFile =
      p.join(config[ConfigKey.scriptDir] as String, Defaults.scriptsFile);
  await File(scriptsFile)
      .writeAsString(const JsonEncoder.withIndent('  ').convert(scripts));
}
