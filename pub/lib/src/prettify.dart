import 'constants.dart';

class Prettify {
  static const _reset = '\x1B[0m';
  static const _red = '\x1B[31m';
  static const _green = '\x1B[32m';
  static const _blue = '\x1B[34m';
  static const _yellow = '\x1B[33m';
  static const _underline = '\x1B[4m';

  static String error(String message) => '$_red$message$_reset';
  static String success(String message) => '$_green$message$_reset';
  static String info(String message) => '$_blue$message$_reset';
  static String link(String message) => '$_blue$_underline$message$_reset';

  static String announcement(String message) {
    final border = '╭${'─' * announcementBoxWidth}╮';
    final bottom = '╰${'─' * announcementBoxWidth}╯';
    final lines = message.split('\n').map((l) => '│ $_yellow${l.padRight(announcementContentWidth)}$_reset │');
    return '\n$border\n${lines.join('\n')}\n$bottom\n';
  }
}
