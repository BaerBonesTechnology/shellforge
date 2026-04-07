import 'dart:io';

const String packageName = 'shellforge';

abstract final class ConfigKey {
  static const announcements = 'announcements';
  static const defaultScriptPath = 'defaultScriptPath';
  static const defaultTextEditorCommand = 'defaultTextEditorCommand';
  static const defaultTextEditorPath = 'defaultTextEditorPath';
  static const initMessages = 'init_messages';
  static const initialized = 'initialized';
  static const scriptCommandDir = 'scriptCommandDir';
  static const scriptDir = 'scriptDir';
  static const scriptFileName = 'scriptFileName';
  static const terminalProfile = 'terminalProfile';
  static const tutorial = 'tutorial';
}

abstract final class ScriptKey {
  static const name = 'name';
  static const path = 'path';
  static const script = 'script';
}

abstract final class ContentKey {
  static const finished = 'finished';
  static const message = 'message';
  static const messages = 'messages';
  static const output = 'output';
  static const steps = 'steps';
  static const subSteps = 'subSteps';
  static const title = 'title';
  static const version = 'version';
}

abstract final class Shell {
  static const bash = 'bash';
  static const zsh = 'zsh';
  static const powershell = 'powershell';
  static const cmd = 'cmd';
  static const all = [bash, zsh, powershell, cmd];
  static String get platformDefault =>
      Platform.isWindows ? powershell : bash;
}

abstract final class ShellExt {
  static const sh = '.sh';
  static const ps1 = '.ps1';
  static const bat = '.bat';
}

abstract final class EnvVar {
  static const home = 'HOME';
  static const userProfile = 'USERPROFILE';
}

abstract final class Defaults {
  static const editor = 'code';
  static const fallbackEditorWindows = 'notepad';
  static const fallbackEditorUnix = 'open';
  static const scriptDirName = '.scripts';
  static const commandsDirName = 'commands';
  static const configDirName = '.shellforge';
  static const configFile = 'config.json';
  static const scriptsFile = 'scripts.json';
  static const homeFallback = '.';
  static const scriptPath = '.';
  static const tempRunPrefix = '_temp_run';
  static const scriptBaseName = 'script';
  static const userHomePlaceholder = r'$USER_HOME';
}

abstract final class AnnouncementFilter {
  static const list = 'LIST';
  static const all = 'ALL';
}

abstract final class ReinitOption {
  static const move = 'Move To New Location';
  static const delete = 'Delete Existing Scripts';
  static const cancel = 'Cancel';
  static const all = [move, delete, cancel];
}

abstract final class ParamType {
  static const required = 'required';
  static const optional = 'optional';
  static const nullable = 'nullable';
  static const all = [required, optional, nullable];
}

const int announcementBoxWidth = 60;
const int announcementContentWidth = announcementBoxWidth - 2;
