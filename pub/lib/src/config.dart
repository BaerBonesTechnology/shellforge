import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

const String currentVersion = '0.0.41';

final Map<String, dynamic> defaultConfig = {
  'announcements': [
    {
      'version': '0.0.41',
      'messages': [
        'Welcome and thank you for using ShellForge! Run `forge help` to see all commands.',
        'Tips:\n- `forge create` to build a new script\n- `forge run <name>` to run it\n- Scripts stored in ~/.scripts by default',
      ],
    }
  ],
  'defaultTextEditorCommand': 'code',
  'defaultTextEditorPath': null,
  'scriptDir': '~/.scripts',
  'scriptCommandDir': '~/.scripts/commands',
  'scriptFileName': 'scripts.json',
  'defaultScriptPath': '.',
  'terminalProfile': Platform.isWindows ? 'powershell' : 'bash',
  'initialized': false,
  'init_messages': [
    'Thank you for using ShellForge.\nIf this is your first time, run through the tutorial during init!',
  ],
  'tutorial': {
    'steps': [
      {
        'title': 'Welcome to ShellForge',
        'message':
            'ShellForge lets you create and run reusable command sequences. Would you like a quick tutorial?',
      },
      {
        'title': 'Initialization',
        'message':
            'First, pick your shell and where scripts are stored.\n\nLet\'s do it!\n',
      },
      {
        'title': 'Creating a new script',
        'message':
            'Now let\'s create a script. The builder will walk you through it step by step.',
        'subSteps': [
          {
            'output':
                'Name the script, choose where it runs from, then add commands with parameters.',
            'finished':
                'You\'ve created your first script! Run it with `forge run <name>`.\nUse `forge help` to see everything else.',
          }
        ],
      },
    ],
  },
};

final String _userConfigDir =
    p.join(Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'] ?? '.', '.shellforge');
final String _configFile = p.join(_userConfigDir, 'config.json');

String resolveTilde(String path) {
  final home = Platform.environment['HOME'] ??
      Platform.environment['USERPROFILE'] ??
      '.';
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
  if (data['scriptDir'] is String) {
    data['scriptDir'] = resolveTilde(data['scriptDir'] as String);
  }
  if (data['scriptCommandDir'] is String) {
    data['scriptCommandDir'] =
        resolveTilde(data['scriptCommandDir'] as String);
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
        p.join(config['scriptDir'] as String, 'scripts.json');
    final file = File(scriptsFile);
    if (!file.existsSync()) return [];
    final list = jsonDecode(await file.readAsString()) as List;
    return list.cast<Map<String, dynamic>>().map((s) {
      if (s['path'] is String) s['path'] = resolveTilde(s['path'] as String);
      if (s['script'] is String) {
        s['script'] = resolveTilde(s['script'] as String);
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
      p.join(config['scriptDir'] as String, 'scripts.json');
  await File(scriptsFile)
      .writeAsString(const JsonEncoder.withIndent('  ').convert(scripts));
}
