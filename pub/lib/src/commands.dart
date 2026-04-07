import 'dart:io';
import 'package:path/path.dart' as p;

import 'config.dart';
import 'constants.dart';
import 'prettify.dart';
import 'prompt.dart';
import 'utils.dart';

Future<void> checkInit() async {
  final config = await loadConfig();
  if (config[ConfigKey.initialized] != true) {
    print(Prettify.error(
        'Forge is not initialized. Please run "forge init" to initialize it.'));
    exit(1);
  }
}

Future<void> checkForUpdates() async {
  try {
    final result = await Process.run('dart', ['pub', 'global', 'list']);
    final output = result.stdout as String;
    for (final line in output.split('\n')) {
      if (line.startsWith('$packageName ')) {
                break;
      }
    }
  } catch (_) {
      }
}


Future<void> announcements({String? versionChoice}) async {
  final config = await loadConfig();
  await checkInit();

  versionChoice ??= currentVersion;

  if (versionChoice == AnnouncementFilter.list) {
    return _announcementVersionList(config);
  }

  print(Prettify.info('Loading announcements for version: $versionChoice'));
  final items = config[ConfigKey.announcements] as List? ?? [];
  for (final entry in items) {
    final map = entry as Map<String, dynamic>;
    if (map[ContentKey.version] == versionChoice || versionChoice == AnnouncementFilter.all) {
      var output = 'Announcements for version: ${map[ContentKey.version]}\n';
      final messages = map[ContentKey.messages] as List? ?? map[ContentKey.message] as List? ?? [];
      for (final msg in messages) {
        output += '    - $msg\n';
      }
      print(Prettify.announcement(output));
    }
  }
}

Future<void> _announcementVersionList(Map<String, dynamic> config) async {
  final items = config[ConfigKey.announcements] as List? ?? [];
  final versions = items.map((e) => (e as Map)[ContentKey.version] as String).toList();
  versions.add(AnnouncementFilter.all);
  final choice =
      listChoice('Select a version to view announcements for:', versions);
  await announcements(versionChoice: choice);
}


Future<void> initialize() async {
  final config = await loadConfig();
  if (config[ConfigKey.initialized] == true) {
    print(Prettify.info('ShellForge is already initialized!'));
  }

  final initMessages = config[ConfigKey.initMessages];
  if (initMessages is List) {
    print(Prettify.announcement(initMessages.join('\n')));
  }

  var runTutorial = false;
  if (config[ConfigKey.initialized] != true) {
    final tutorial = config[ConfigKey.tutorial] as Map<String, dynamic>?;
    final steps = tutorial?[ContentKey.steps] as List? ?? [];
    if (steps.isNotEmpty) {
      runTutorial = confirm(
          (steps[0] as Map)[ContentKey.message] as String? ?? 'Run tutorial?');
      if (runTutorial && steps.length > 1) {
        print(Prettify.announcement(
            (steps[1] as Map)[ContentKey.message] as String? ?? ''));
      }
    }
  }

  await checkForUpdates();

  final terminalProfile = listChoice(
    'Select your terminal profile:',
    Shell.all,
    defaultChoice: Shell.platformDefault,
  );

  final home = Platform.environment[EnvVar.home] ??
      Platform.environment[EnvVar.userProfile] ??
      Defaults.homeFallback;
  final defaultScriptDir =
      (config[ConfigKey.scriptDir] as String?)?.replaceAll(Defaults.userHomePlaceholder, home) ??
          p.join(home, Defaults.scriptDirName);

  final scriptDir = inputWithValidation(
    'Enter the path where scripts will be stored',
    defaultValue: defaultScriptDir,
  );

  config[ConfigKey.terminalProfile] = terminalProfile;
  config[ConfigKey.scriptDir] = scriptDir;
  config[ConfigKey.scriptCommandDir] = p.join(scriptDir, Defaults.commandsDirName);
  config[ConfigKey.initialized] = true;

  await saveConfig(config);
  print(Prettify.success('ShellForge initialized successfully!'));

  if (runTutorial) {
    final steps =
        (config[ConfigKey.tutorial] as Map<String, dynamic>?)?[ContentKey.steps] as List? ?? [];
    if (steps.length > 2) {
      print(Prettify.announcement(
          (steps[2] as Map)[ContentKey.message] as String? ?? ''));
    }
    await createScriptWithPrompt(tutorialRunning: true);
  }
}


Future<String> buildCommands() async {
  final commands = <String>[];
  var addMore = true;

  while (addMore) {
    final baseCommand = inputWithValidation(
      'Enter the base command (e.g. flutter create, git push)',
    );

    final params = <String>[];
    var addParam = true;
    while (addParam) {
      if (!confirm('Add a parameter?')) {
        addParam = false;
        break;
      }

      final paramName = inputWithValidation(
        'Parameter name (e.g. name, --org, --platforms)',
      );

      final paramType = listChoice(
        'Type for $paramName:',
        ParamType.all,
        defaultChoice: ParamType.required,
      );

      if (paramType == ParamType.optional) {
        final defaultValue =
            inputWithValidation('Default value for $paramName');
        params.add('{$paramName=>$defaultValue}');
      } else if (paramType == ParamType.nullable) {
        params.add('?{$paramName}');
      } else {
        params.add('{$paramName}');
      }
    }

    final fullCommand = [baseCommand.trim(), ...params].join(' ');
    print(Prettify.info('  → $fullCommand'));
    commands.add(fullCommand);

    addMore = confirm('Add another command?', defaultValue: false);
  }

  return commands.join(',');
}

Future<void> createScript(
    String scriptName, String scriptPath, String commands) async {
  final config = await loadConfig();
  final version = currentVersion;
  final profile = config[ConfigKey.terminalProfile] as String? ?? Shell.bash;

  String scriptContent;
  String ext;
  final cmdLines = splitCommands(commands).join('\n');

  switch (profile) {
    case Shell.bash:
      scriptContent =
          '#!/bin/bash\nset -e\n\n# This script is generated by $packageName v:$version\n\n$cmdLines';
      ext = ShellExt.sh;
      break;
    case Shell.zsh:
      scriptContent =
          '#!/bin/zsh\nset -e\n\n# This script is generated by $packageName v:$version\n\n$cmdLines';
      ext = ShellExt.sh;
      break;
    case Shell.powershell:
      scriptContent =
          '\$ErrorActionPreference = "Stop"\n\n<#\n This script is generated by $packageName v:$version\n #>\n$cmdLines';
      ext = ShellExt.ps1;
      break;
    case Shell.cmd:
      final errorCheck = '\nif %errorlevel% neq 0 exit /b %errorlevel%\n';
      scriptContent =
          '@echo off\n\nREM This script is generated by $packageName v:$version\n\n${cmdLines.replaceAll('\n', errorCheck)}';
      ext = ShellExt.bat;
      break;
    default:
      print(Prettify.error('Invalid terminal profile selected.'));
      return;
  }

  final commandFolder =
      p.join(config[ConfigKey.scriptCommandDir] as String, scriptName);

  try {
    await Directory(commandFolder).create(recursive: true);
    final scriptFile = p.join(commandFolder, '${Defaults.scriptBaseName}$ext');
    await File(scriptFile).writeAsString(scriptContent);

    final scripts = await loadScripts();
    scripts.add({
      ScriptKey.name: scriptName,
      ScriptKey.path: scriptPath,
      ScriptKey.script: scriptFile,
    });
    await saveScripts(scripts);

    print(Prettify.success('Script created successfully!'));
  } catch (e) {
    print(Prettify.error('Error creating script: $e'));
  }
}

Future<void> createScriptWithPrompt({bool tutorialRunning = false}) async {
  await checkForUpdates();
  final config = await loadConfig();
  await checkInit();

  if (tutorialRunning) {
    final steps =
        (config[ConfigKey.tutorial] as Map<String, dynamic>?)?[ContentKey.steps] as List? ?? [];
    if (steps.length > 2) {
      final subSteps = (steps[2] as Map)[ContentKey.subSteps] as List?;
      if (subSteps != null && subSteps.isNotEmpty) {
        print(Prettify.announcement(
            (subSteps[0] as Map)[ContentKey.output] as String? ?? ''));
      }
    }
  }

  final scripts = await loadScripts();
  final scriptName = inputWithValidation(
    'Enter script name',
    validator: (value) {
      if (!RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(value)) {
        return 'Please enter a valid script name (alphanumeric, underscore, dash)';
      }
      if (scripts.any((s) => s[ScriptKey.name] == value)) {
        return 'Script name already exists';
      }
      return null;
    },
  );

  final defaultPath =
      p.join(Directory.current.path, config[ConfigKey.defaultScriptPath] as String? ?? Defaults.scriptPath);
  final scriptPath = inputWithValidation(
    'Enter the path where the script will be called from',
    defaultValue: defaultPath,
    validator: (value) {
      final resolved = resolveTilde(value);
      if (!Directory(resolved).existsSync()) {
        return 'Please enter a valid directory path';
      }
      return null;
    },
  );

  String commands;
  if (tutorialRunning) {
    commands = inputWithValidation(
      'Try entering a command (e.g. echo "Hello World!")',
    );
  } else {
    commands = await buildCommands();
  }

  if (!commands.endsWith(',')) commands += ',';

  await createScript(scriptName, resolveTilde(scriptPath), commands);

  if (tutorialRunning) {
    final steps =
        (config[ConfigKey.tutorial] as Map<String, dynamic>?)?[ContentKey.steps] as List? ?? [];
    if (steps.length > 2) {
      final subSteps = (steps[2] as Map)[ContentKey.subSteps] as List?;
      if (subSteps != null && subSteps.isNotEmpty) {
        print(Prettify.announcement(
            (subSteps[0] as Map)[ContentKey.finished] as String? ?? ''));
      }
    }
  }
}


Future<void> deleteScript(String scriptName) async {
  await checkForUpdates();
  await checkInit();

  final scripts = await loadScripts();
  final idx = scripts.indexWhere((s) => s[ScriptKey.name] == scriptName);
  if (idx == -1) {
    print('Script not found');
    return;
  }

  final entry = scripts[idx];
  try {
    scripts.removeAt(idx);
    await saveScripts(scripts);
    final commandFolder = p.dirname(entry[ScriptKey.script] as String);
    await Directory(commandFolder).delete(recursive: true);
    print('Script deleted successfully!');
  } catch (e) {
    print('Error deleting script: $e');
  }
}


Future<void> clearScripts() async {
  final scripts = await loadScripts();
  for (final entry in scripts) {
    print('Deleting script: ${entry[ScriptKey.name]}');
    await deleteScript(entry[ScriptKey.name] as String);
  }
}


Future<void> listScripts() async {
  await checkInit();
  final scripts = await loadScripts();
  if (scripts.isEmpty) {
    print('No scripts found.');
  } else {
    print('List of scripts:');
    for (final entry in scripts) {
      print(entry[ScriptKey.name]);
    }
  }
}


Future<void> runScript(String scriptName,
    {Map<String, String> cliArgs = const {},
    List<String> positionalArgs = const []}) async {
  await checkForUpdates();
  final scripts = await loadScripts();
  final entry = scripts.cast<Map<String, dynamic>?>().firstWhere(
        (s) => s![ScriptKey.name] == scriptName,
        orElse: () => null,
      );

  if (entry == null) {
    print(Prettify.error('Script not found'));
    return;
  }

  await checkInit();
  final config = await loadConfig();
  final profile = config[ConfigKey.terminalProfile] as String? ?? Shell.bash;

  final scriptFile = entry[ScriptKey.script] as String;
  final scriptPath = entry[ScriptKey.path] as String;

  print('Running script: ${entry[ScriptKey.name]}');

  var scriptContent = await File(scriptFile).readAsString();

  final hasParams = RegExp(
          r'(?:\?\{|\{-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*=>?|(?<!\?)\{-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*\})')
      .hasMatch(scriptContent);

  var scriptToRun = scriptFile;

  if (hasParams) {
    scriptContent = await resolveFlowParams(
      scriptContent,
      cliArgs: cliArgs,
      promptFn: (names) async {
        print(Prettify.info(
            'This script requires parameter(s): ${names.map((n) => '{$n}').join(', ')}'));
        final answers = <String, String>{};
        for (final name in names) {
          final key = toCliKey(name);
          answers[key] = inputWithValidation('Enter value for {$name}');
        }
        return answers;
      },
      positionalArgs: positionalArgs,
    );
    final ext = p.extension(scriptFile);
    scriptToRun = p.join(p.dirname(scriptFile), '${Defaults.tempRunPrefix}$ext');
    await File(scriptToRun).writeAsString(scriptContent);
  }

  String executable;
  List<String> shellArgs;
  switch (profile) {
    case Shell.bash:
    case Shell.zsh:
      executable = 'sh';
      shellArgs = [scriptToRun];
      break;
    case Shell.powershell:
      executable = Shell.powershell;
      shellArgs = ['-File', scriptToRun];
      break;
    case Shell.cmd:
      executable = Shell.cmd;
      shellArgs = ['/c', scriptToRun];
      break;
    default:
      print('Invalid terminal profile selected.');
      return;
  }

  try {
    final process = await Process.start(executable, shellArgs,
        workingDirectory: scriptPath, mode: ProcessStartMode.inheritStdio);
    final exitCode = await process.exitCode;
    if (exitCode != 0) {
      print('Error running script: Script exited with code $exitCode');
    }
  } catch (e) {
    print('Error running script: $e');
  } finally {
    if (hasParams && scriptToRun != scriptFile) {
      try {
        await File(scriptToRun).delete();
      } catch (_) {}
    }
    print('Finished.');
  }
}


Future<void> openScriptForEditing(String scriptName,
    {String? openCommand, String? editorPath}) async {
  final config = await loadConfig();
  await checkInit();

  if (openCommand != null || editorPath != null) {
    if (openCommand != null && editorPath != null) {
      print(Prettify.error(
          'Please provide either --openCommand or --path, not both.'));
      return;
    }
    if (openCommand != null) {
      config[ConfigKey.defaultTextEditorCommand] = openCommand;
      config[ConfigKey.defaultTextEditorPath] = null;
    }
    if (editorPath != null) {
      config[ConfigKey.defaultTextEditorCommand] = null;
      config[ConfigKey.defaultTextEditorPath] = editorPath;
    }
    await saveConfig(config);
  }

  final scripts = await loadScripts();
  final entry = scripts.cast<Map<String, dynamic>?>().firstWhere(
        (s) => s![ScriptKey.name] == scriptName,
        orElse: () => null,
      );

  if (entry == null) {
    print('Script not found');
    return;
  }

  print('Opening script for editing: ${entry[ScriptKey.name]}');
  final editor = (config[ConfigKey.defaultTextEditorCommand] ??
      config[ConfigKey.defaultTextEditorPath] ??
      Defaults.editor) as String;

  try {
    await Process.run(editor, [entry[ScriptKey.script] as String]);
  } catch (_) {
    try {
      if (Platform.isWindows) {
        await Process.run(Defaults.fallbackEditorWindows, [entry[ScriptKey.script] as String]);
      } else {
        await Process.run(Defaults.fallbackEditorUnix, [entry[ScriptKey.script] as String]);
      }
    } catch (e) {
      print('Error opening script for editing: $e');
    }
  }
  print(Prettify.success('Finished.'));
}


Future<void> reinitialize() async {
  await checkForUpdates();
  final config = await loadConfig();
  final scripts = await loadScripts();

  if (scripts.isNotEmpty) {
    final choice = listChoice(
      'You are about to reinitialize ShellForge. What would you like to do with existing scripts?',
      ReinitOption.all,
      defaultChoice: ReinitOption.move,
    );

    switch (choice) {
      case ReinitOption.move:
        final newLocation = inputWithValidation(
          'Enter the path where scripts will be stored',
          defaultValue: config[ConfigKey.scriptDir] as String?,
        );
        try {
          await _copyDirectory(
              Directory(config[ConfigKey.scriptDir] as String), Directory(newLocation));
          await Directory(config[ConfigKey.scriptDir] as String)
              .delete(recursive: true);
          print('Scripts moved successfully!\n\nNew location: $newLocation');
        } catch (e) {
          print(Prettify.error('Error moving scripts: $e'));
          return;
        }
        config[ConfigKey.scriptDir] = newLocation;
        config[ConfigKey.scriptCommandDir] = p.join(newLocation, Defaults.commandsDirName);
        config[ConfigKey.initialized] = true;
        await saveConfig(config);
        break;
      case ReinitOption.delete:
        try {
          await Directory(config[ConfigKey.scriptDir] as String)
              .delete(recursive: true);
        } catch (e) {
          print(Prettify.error('Error deleting scripts: $e'));
          return;
        }
        config[ConfigKey.initialized] = false;
        await saveConfig(config);
        await initialize();
        break;
      case ReinitOption.cancel:
        return;
    }
  }
}

Future<void> _copyDirectory(Directory source, Directory destination) async {
  await destination.create(recursive: true);
  await for (final entity in source.list(recursive: false)) {
    final newPath = p.join(destination.path, p.basename(entity.path));
    if (entity is Directory) {
      await _copyDirectory(entity, Directory(newPath));
    } else if (entity is File) {
      await entity.copy(newPath);
    }
  }
}


Future<void> resetConfig() async {
  final home = Platform.environment[EnvVar.home] ??
      Platform.environment[EnvVar.userProfile] ??
      Defaults.homeFallback;
  final config = await loadConfig();
  config[ConfigKey.scriptDir] = p.join(home, Defaults.scriptDirName);
  config[ConfigKey.scriptCommandDir] = p.join(home, Defaults.scriptDirName, Defaults.commandsDirName);
  config[ConfigKey.terminalProfile] = Shell.platformDefault;
  config[ConfigKey.defaultScriptPath] = Defaults.scriptPath;
  config[ConfigKey.initialized] = false;
  await saveConfig(config);
}

Future<void> viewConfig() async {
  final config = await loadConfig();
  print(config);
}
