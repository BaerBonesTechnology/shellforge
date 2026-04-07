library;

bool compareVersions(String latestVersion, String currentVersion) {
  if (latestVersion == currentVersion) return false;

  final latest = latestVersion.split('.').map(int.parse).toList();
  final current = currentVersion.split('.').map(int.parse).toList();

  if (latest[0] > current[0]) {
    return true;
  }
  if (latest[0] == current[0] && latest[1] > current[1]) {
    return true;
  }
  if (latest[0] == current[0] &&
      latest[1] == current[1] &&
      latest[2] > current[2]) {
    return true;
  }

  return false;
}

String toCliKey(String name) => name.replaceAll(RegExp(r'^-+'), '');

String formatValue(String name, String value) {
  if (value.isEmpty) return '';
  return name.startsWith('-') ? '$name=$value' : value;
}

typedef PromptFn = Future<Map<String, String>> Function(List<String> names);

Future<String> resolveFlowParams(
  String scriptContent, {
  Map<String, String> cliArgs = const {},
  PromptFn? promptFn,
  List<String> positionalArgs = const [],
}) async {
  final requiredPattern =
      RegExp(r'(?<!\?)\{(-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*)\}');
  final nullablePattern = RegExp(r'\?\{(-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*)\}');
  final optionalPattern =
      RegExp(r'\{(-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*)=>?(.*?)\}');

  final requiredMatches = requiredPattern.allMatches(scriptContent).toList();
  final nullableMatches = nullablePattern.allMatches(scriptContent).toList();
  final optionalMatches = optionalPattern.allMatches(scriptContent).toList();

  if (requiredMatches.isEmpty &&
      nullableMatches.isEmpty &&
      optionalMatches.isEmpty) {
    return scriptContent;
  }

  final requiredNames =
      requiredMatches.map((m) => m.group(1)!).toSet().toList();
  final nullableNames =
      nullableMatches.map((m) => m.group(1)!).toSet().toList();
  final optionalDefaults = <String, String>{};
  for (final m in optionalMatches) {
    optionalDefaults[m.group(1)!] = m.group(2)!;
  }
  final optionalNames = optionalDefaults.keys.toSet().toList();

  final resolved = <String, String>{};
  final needsPrompt = <String>[];

    final positionalQueue = List<String>.from(positionalArgs);

  for (final name in requiredNames) {
    final key = toCliKey(name);
    if (cliArgs.containsKey(key)) {
      resolved[name] = cliArgs[key]!;
    } else if (!name.startsWith('-') && positionalQueue.isNotEmpty) {
      resolved[name] = positionalQueue.removeAt(0);
    } else {
      needsPrompt.add(name);
    }
  }

  for (final name in optionalNames) {
    final key = toCliKey(name);
    if (cliArgs.containsKey(key)) {
      resolved[name] = cliArgs[key]!;
    } else {
      resolved[name] = optionalDefaults[name]!;
    }
  }

  for (final name in nullableNames) {
    final key = toCliKey(name);
    if (cliArgs.containsKey(key)) {
      resolved[name] = cliArgs[key]!;
    } else {
      resolved[name] = '';
    }
  }

  if (needsPrompt.isNotEmpty) {
    if (promptFn == null) {
      final displayNames = needsPrompt.map(toCliKey).toList();
      throw Exception(
          'Missing required parameters: ${displayNames.join(', ')}');
    }
    final answers = await promptFn(needsPrompt);
    for (final name in needsPrompt) {
      resolved[name] = answers[toCliKey(name)] ?? '';
    }
  }

  var result = scriptContent;

  for (final name in optionalNames) {
    final escapedDefault = RegExp.escape(optionalDefaults[name]!);
    final escapedName = RegExp.escape(name);
    final pattern = RegExp('\\{$escapedName=>?$escapedDefault\\}');
    result = result.replaceAll(pattern, formatValue(name, resolved[name]!));
  }

  for (final name in nullableNames) {
    result = result.replaceAll('?{$name}', formatValue(name, resolved[name]!));
  }

  for (final name in requiredNames) {
    result = result.replaceAll('{$name}', formatValue(name, resolved[name]!));
  }

  return result;
}

List<String> splitCommands(String str) {
  final parts = <String>[];
  var current = StringBuffer();
  var depth = 0;
  for (final ch in str.split('')) {
    if (ch == '{') depth++;
    if (ch == '}') depth--;
    if (ch == ',' && depth == 0) {
      parts.add(current.toString());
      current = StringBuffer();
    } else {
      current.write(ch);
    }
  }
  final remaining = current.toString();
  if (remaining.isNotEmpty) parts.add(remaining);
  return parts.where((p) => p.trim().isNotEmpty).toList();
}
