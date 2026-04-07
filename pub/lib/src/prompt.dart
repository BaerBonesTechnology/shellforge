import 'dart:io';

String readLine(String prompt) {
  stdout.write(prompt);
  return stdin.readLineSync() ?? '';
}

bool confirm(String message, {bool defaultValue = true}) {
  final suffix = defaultValue ? '(Y/n)' : '(y/N)';
  stdout.write('$message $suffix: ');
  final input = (stdin.readLineSync() ?? '').trim().toLowerCase();
  if (input.isEmpty) return defaultValue;
  return input == 'y' || input == 'yes';
}

String listChoice(String message, List<String> choices,
    {String? defaultChoice}) {
  print(message);
  for (var i = 0; i < choices.length; i++) {
    final marker = choices[i] == defaultChoice ? ' (default)' : '';
    print('  ${i + 1}) ${choices[i]}$marker');
  }
  while (true) {
    stdout.write('Choice [1-${choices.length}]: ');
    final input = (stdin.readLineSync() ?? '').trim();
    if (input.isEmpty && defaultChoice != null) return defaultChoice;
    final idx = int.tryParse(input);
    if (idx != null && idx >= 1 && idx <= choices.length) {
      return choices[idx - 1];
    }
    print('Please enter a number between 1 and ${choices.length}.');
  }
}

String inputWithValidation(String message,
    {String? defaultValue, String? Function(String)? validator}) {
  while (true) {
    final suffix = defaultValue != null ? ' ($defaultValue)' : '';
    stdout.write('$message$suffix: ');
    var input = (stdin.readLineSync() ?? '').trim();
    if (input.isEmpty && defaultValue != null) input = defaultValue;
    if (validator != null) {
      final error = validator(input);
      if (error != null) {
        print(error);
        continue;
      }
    }
    if (input.isEmpty) {
      print('A value is required.');
      continue;
    }
    return input;
  }
}
