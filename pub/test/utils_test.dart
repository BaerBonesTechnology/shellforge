import 'package:test/test.dart';
import 'package:shellforge/src/utils.dart';

void main() {
  group('compareVersions', () {
    test('returns false when versions are equal', () {
      expect(compareVersions('1.0.2', '1.0.2'), false);
    });

    test('detects major version bump', () {
      expect(compareVersions('2.0.0', '1.0.2'), true);
    });

    test('detects minor version bump', () {
      expect(compareVersions('1.1.0', '1.0.2'), true);
    });

    test('detects patch version bump', () {
      expect(compareVersions('1.0.3', '1.0.2'), true);
    });

    test('returns false when latest is older (major)', () {
      expect(compareVersions('0.9.9', '1.0.2'), false);
    });

    test('returns false when latest is older (minor)', () {
      expect(compareVersions('1.0.1', '1.0.2'), false);
    });

    test('handles double-digit version segments numerically', () {
      expect(compareVersions('1.0.10', '1.0.2'), true);
    });
  });

  group('resolveFlowParams', () {
    group('no params', () {
      test('returns content unchanged when there are no placeholders',
          () async {
        final script = 'echo "hello world"';
        expect(await resolveFlowParams(script), script);
      });
    });

    group('required {param}', () {
      test('replaces a single required param from CLI args', () async {
        final result = await resolveFlowParams(
          'git commit -m "{message}"',
          cliArgs: {'message': 'fix bug'},
        );
        expect(result, 'git commit -m "fix bug"');
      });

      test('replaces multiple occurrences of the same param', () async {
        final result = await resolveFlowParams(
          'echo {name} && echo {name}',
          cliArgs: {'name': 'hello'},
        );
        expect(result, 'echo hello && echo hello');
      });

      test('replaces multiple different required params', () async {
        final result = await resolveFlowParams(
          '{greeting} {target}',
          cliArgs: {'greeting': 'hello', 'target': 'world'},
        );
        expect(result, 'hello world');
      });

      test('throws when required param is missing and no promptFn', () async {
        expect(
          () => resolveFlowParams('echo {name}'),
          throwsA(isA<Exception>().having(
              (e) => e.toString(), 'message', contains('Missing required'))),
        );
      });

      test('prompts for missing required params via promptFn', () async {
        final result = await resolveFlowParams(
          'echo {name}',
          promptFn: (_) async => {'name': 'prompted_value'},
        );
        expect(result, 'echo prompted_value');
      });
    });

    group('nullable ?{param}', () {
      test('replaces nullable param with value when provided', () async {
        final result = await resolveFlowParams(
          'git push ?{remote} main',
          cliArgs: {'remote': 'origin'},
        );
        expect(result, 'git push origin main');
      });

      test('replaces nullable param with empty string when not provided',
          () async {
        final result = await resolveFlowParams('git push ?{remote} main');
        expect(result, 'git push  main');
      });

      test('handles multiple nullable params', () async {
        final result = await resolveFlowParams(
          'cmd ?{flag1} ?{flag2} end',
          cliArgs: {'flag1': '-v'},
        );
        expect(result, 'cmd -v  end');
      });
    });

    group('optional {param=>default}', () {
      test('uses default value when param is not provided', () async {
        final result =
            await resolveFlowParams('git push origin {branch=>main}');
        expect(result, 'git push origin main');
      });

      test('uses CLI value when provided, overriding default', () async {
        final result = await resolveFlowParams(
          'git push origin {branch=>main}',
          cliArgs: {'branch': 'dev'},
        );
        expect(result, 'git push origin dev');
      });

      test('handles default with special regex characters', () async {
        final result =
            await resolveFlowParams('echo {path=>/usr/local/bin}');
        expect(result, 'echo /usr/local/bin');
      });

      test('handles multiple optional params with different defaults',
          () async {
        final result = await resolveFlowParams(
          '{host=>localhost}:{port=>3000}',
          cliArgs: {'port': '8080'},
        );
        expect(result, 'localhost:8080');
      });

      test('accepts = as shorthand for =>', () async {
        final result =
            await resolveFlowParams('git push origin {branch=main}');
        expect(result, 'git push origin main');
      });

      test('accepts = shorthand with flag-style param', () async {
        final result = await resolveFlowParams(
          'flutter create {name} {--org=com.baerhous} {--platforms=ios,android}',
          positionalArgs: ['millet'],
        );
        expect(result,
            'flutter create millet --org=com.baerhous --platforms=ios,android');
      });
    });

    group('flag-style params (-- prefix)', () {
      test('optional flag auto-inserts = with default', () async {
        final result = await resolveFlowParams(
          'flutter create {name} {--org=>com.example}',
          cliArgs: {'name': 'myapp'},
        );
        expect(result, 'flutter create myapp --org=com.example');
      });

      test('optional flag with CLI override', () async {
        final result = await resolveFlowParams(
          'flutter create {name} {--org=>com.example}',
          cliArgs: {'name': 'myapp', 'org': 'com.custom'},
        );
        expect(result, 'flutter create myapp --org=com.custom');
      });

      test('nullable flag inserts flag=value when provided', () async {
        final result = await resolveFlowParams(
          'flutter create {name} ?{--platforms}',
          cliArgs: {'name': 'myapp', 'platforms': 'ios,android'},
        );
        expect(result, 'flutter create myapp --platforms=ios,android');
      });

      test('nullable flag removed entirely when not provided', () async {
        final result = await resolveFlowParams(
          'flutter create {name} ?{--platforms}',
          cliArgs: {'name': 'myapp'},
        );
        expect(result, 'flutter create myapp ');
      });

      test('full flutter example with all param types', () async {
        final result = await resolveFlowParams(
          'flutter create {name} {--org=>com.example} ?{--platforms}',
          cliArgs: {'name': 'demo', 'platforms': 'ios,android'},
        );
        expect(result,
            'flutter create demo --org=com.example --platforms=ios,android');
      });

      test('single-dash flag works', () async {
        final result =
            await resolveFlowParams('cmd {-o=>output.txt}');
        expect(result, 'cmd -o=output.txt');
      });
    });

    group('mixed param types', () {
      test('handles required + nullable + optional together', () async {
        final result = await resolveFlowParams(
          'git commit -m "{message}" && git push ?{remote} {branch=>main}',
          cliArgs: {'message': 'init'},
        );
        expect(result, 'git commit -m "init" && git push  main');
      });

      test('all types provided via CLI', () async {
        final result = await resolveFlowParams(
          'git commit -m "{message}" && git push ?{remote} {branch=>main}',
          cliArgs: {'message': 'init', 'remote': 'origin', 'branch': 'dev'},
        );
        expect(result, 'git commit -m "init" && git push origin dev');
      });
    });

    group('positional args', () {
      test('maps positional args to non-flag required params in order',
          () async {
        final result = await resolveFlowParams(
          'flutter create {name} {--org=>com.example} ?{--platforms}',
          cliArgs: {'org': 'com.fli', 'platforms': 'ios,android'},
          positionalArgs: ['example'],
        );
        expect(result,
            'flutter create example --org=com.fli --platforms=ios,android');
      });

      test('maps multiple positional args in order', () async {
        final result = await resolveFlowParams(
          'cp {source} {destination}',
          positionalArgs: ['file.txt', '/tmp/'],
        );
        expect(result, 'cp file.txt /tmp/');
      });

      test('positional args do not fill flag-style required params',
          () async {
        expect(
          () => resolveFlowParams('cmd {--flag}', positionalArgs: ['value']),
          throwsA(isA<Exception>().having(
              (e) => e.toString(), 'message', contains('Missing required'))),
        );
      });

      test('named CLI args take precedence over positional args', () async {
        final result = await resolveFlowParams(
          'echo {name}',
          cliArgs: {'name': 'from-flag'},
          positionalArgs: ['from-positional'],
        );
        expect(result, 'echo from-flag');
      });

      test('prompts for remaining required params after positionals exhausted',
          () async {
        final result = await resolveFlowParams(
          'cmd {first} {second}',
          promptFn: (_) async => {'second': 'prompted'},
          positionalArgs: ['positional'],
        );
        expect(result, 'cmd positional prompted');
      });

      test('full flutter workflow: positional + flags + nullable', () async {
        final result = await resolveFlowParams(
          'flutter create {name} {--org=>com.example} ?{--platforms}',
          cliArgs: {'platforms': 'ios,android'},
          positionalArgs: ['demo'],
        );
        expect(result,
            'flutter create demo --org=com.example --platforms=ios,android');
      });
    });
  });

  group('splitCommands', () {
    test('splits simple comma-separated commands', () {
      expect(splitCommands('echo a,echo b'), ['echo a', 'echo b']);
    });

    test('preserves commas inside placeholders', () {
      expect(
        splitCommands(
            'flutter create {name} {--platforms=ios,android},echo done'),
        [
          'flutter create {name} {--platforms=ios,android}',
          'echo done',
        ],
      );
    });

    test('filters empty segments', () {
      expect(splitCommands('echo a,,echo b,'), ['echo a', 'echo b']);
    });
  });
}
