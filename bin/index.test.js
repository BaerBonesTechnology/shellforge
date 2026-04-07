import { describe, it, expect } from 'vitest';
import { compareVersions, resolveFlowParams } from './utils.js';

const CURRENT = '1.0.2';


describe('compareVersions', () => {
  it('returns false when versions are equal', () => {
    expect(compareVersions(CURRENT, CURRENT)).toBe(false);
  });

  it('detects major version bump', () => {
    expect(compareVersions('2.0.0', CURRENT)).toBe(true);
  });

  it('detects minor version bump', () => {
    expect(compareVersions('1.1.0', CURRENT)).toBe(true);
  });

  it('detects patch version bump', () => {
    expect(compareVersions('1.0.3', CURRENT)).toBe(true);
  });

  it('returns false when latest is older (major)', () => {
    expect(compareVersions('0.9.9', CURRENT)).toBe(false);
  });

  it('returns false when latest is older (minor)', () => {
    expect(compareVersions('1.0.1', CURRENT)).toBe(false);
  });

  it('handles double-digit version segments numerically', () => {
    expect(compareVersions('1.0.10', CURRENT)).toBe(true);
  });
});


describe('resolveFlowParams', () => {

  describe('no params', () => {
    it('returns content unchanged when there are no placeholders', async () => {
      const script = 'echo "hello world"';
      expect(await resolveFlowParams(script, {})).toBe(script);
    });
  });

  describe('required {param}', () => {
    it('replaces a single required param from CLI args', async () => {
      const script = 'git commit -m "{message}"';
      const result = await resolveFlowParams(script, { message: 'fix bug' });
      expect(result).toBe('git commit -m "fix bug"');
    });

    it('replaces multiple occurrences of the same param', async () => {
      const script = 'echo {name} && echo {name}';
      const result = await resolveFlowParams(script, { name: 'hello' });
      expect(result).toBe('echo hello && echo hello');
    });

    it('replaces multiple different required params', async () => {
      const script = '{greeting} {target}';
      const result = await resolveFlowParams(script, { greeting: 'hello', target: 'world' });
      expect(result).toBe('hello world');
    });

    it('throws when required param is missing and no promptFn', async () => {
      const script = 'echo {name}';
      await expect(resolveFlowParams(script, {})).rejects.toThrow('Missing required parameters: name');
    });

    it('prompts for missing required params via promptFn', async () => {
      const script = 'echo {name}';
      const mockPrompt = async () => ({ name: 'prompted_value' });
      const result = await resolveFlowParams(script, {}, mockPrompt);
      expect(result).toBe('echo prompted_value');
    });
  });

  describe('nullable ?{param}', () => {
    it('replaces nullable param with value when provided', async () => {
      const script = 'git push ?{remote} main';
      const result = await resolveFlowParams(script, { remote: 'origin' });
      expect(result).toBe('git push origin main');
    });

    it('replaces nullable param with empty string when not provided', async () => {
      const script = 'git push ?{remote} main';
      const result = await resolveFlowParams(script, {});
      expect(result).toBe('git push  main');
    });

    it('handles multiple nullable params', async () => {
      const script = 'cmd ?{flag1} ?{flag2} end';
      const result = await resolveFlowParams(script, { flag1: '-v' });
      expect(result).toBe('cmd -v  end');
    });
  });

  describe('optional {param=>default}', () => {
    it('uses default value when param is not provided', async () => {
      const script = 'git push origin {branch=>main}';
      const result = await resolveFlowParams(script, {});
      expect(result).toBe('git push origin main');
    });

    it('uses CLI value when provided, overriding default', async () => {
      const script = 'git push origin {branch=>main}';
      const result = await resolveFlowParams(script, { branch: 'dev' });
      expect(result).toBe('git push origin dev');
    });

    it('handles default with special regex characters', async () => {
      const script = 'echo {path=>/usr/local/bin}';
      const result = await resolveFlowParams(script, {});
      expect(result).toBe('echo /usr/local/bin');
    });

    it('handles multiple optional params with different defaults', async () => {
      const script = '{host=>localhost}:{port=>3000}';
      const result = await resolveFlowParams(script, { port: '8080' });
      expect(result).toBe('localhost:8080');
    });

    it('accepts = as shorthand for =>', async () => {
      const script = 'git push origin {branch=main}';
      const result = await resolveFlowParams(script, {});
      expect(result).toBe('git push origin main');
    });

    it('accepts = shorthand with flag-style param', async () => {
      const script = 'flutter create {name} {--org=com.baerhous} {--platforms=ios,android}';
      const result = await resolveFlowParams(script, {}, null, ['millet']);
      expect(result).toBe('flutter create millet --org=com.baerhous --platforms=ios,android');
    });
  });

  describe('flag-style params (-- prefix)', () => {
    it('optional flag auto-inserts = with default', async () => {
      const script = 'flutter create {name} {--org=>com.example}';
      const result = await resolveFlowParams(script, { name: 'myapp' });
      expect(result).toBe('flutter create myapp --org=com.example');
    });

    it('optional flag with CLI override', async () => {
      const script = 'flutter create {name} {--org=>com.example}';
      const result = await resolveFlowParams(script, { name: 'myapp', org: 'com.custom' });
      expect(result).toBe('flutter create myapp --org=com.custom');
    });

    it('nullable flag inserts flag=value when provided', async () => {
      const script = 'flutter create {name} ?{--platforms}';
      const result = await resolveFlowParams(script, { name: 'myapp', platforms: 'ios,android' });
      expect(result).toBe('flutter create myapp --platforms=ios,android');
    });

    it('nullable flag removed entirely when not provided', async () => {
      const script = 'flutter create {name} ?{--platforms}';
      const result = await resolveFlowParams(script, { name: 'myapp' });
      expect(result).toBe('flutter create myapp ');
    });

    it('full flutter example with all param types', async () => {
      const script = 'flutter create {name} {--org=>com.example} ?{--platforms}';
      const result = await resolveFlowParams(script, { name: 'demo', platforms: 'ios,android' });
      expect(result).toBe('flutter create demo --org=com.example --platforms=ios,android');
    });

    it('single-dash flag works', async () => {
      const script = 'cmd {-o=>output.txt}';
      const result = await resolveFlowParams(script, {});
      expect(result).toBe('cmd -o=output.txt');
    });
  });

  describe('mixed param types', () => {
    it('handles required + nullable + optional together', async () => {
      const script = 'git commit -m "{message}" && git push ?{remote} {branch=>main}';
      const result = await resolveFlowParams(script, { message: 'init' });
      expect(result).toBe('git commit -m "init" && git push  main');
    });

    it('all types provided via CLI', async () => {
      const script = 'git commit -m "{message}" && git push ?{remote} {branch=>main}';
      const result = await resolveFlowParams(script, {
        message: 'init',
        remote: 'origin',
        branch: 'dev',
      });
      expect(result).toBe('git commit -m "init" && git push origin dev');
    });
  });

  describe('positional args', () => {
    it('maps positional args to non-flag required params in order', async () => {
      const script = 'flutter create {name} {--org=>com.example} ?{--platforms}';
      const result = await resolveFlowParams(script, { org: 'com.fli', platforms: 'ios,android' }, null, ['example']);
      expect(result).toBe('flutter create example --org=com.fli --platforms=ios,android');
    });

    it('maps multiple positional args in order', async () => {
      const script = 'cp {source} {destination}';
      const result = await resolveFlowParams(script, {}, null, ['file.txt', '/tmp/']);
      expect(result).toBe('cp file.txt /tmp/');
    });

    it('positional args do not fill flag-style required params', async () => {
      const script = 'cmd {--flag}';
      await expect(resolveFlowParams(script, {}, null, ['value'])).rejects.toThrow('Missing required parameters: flag');
    });

    it('named CLI args take precedence over positional args', async () => {
      const script = 'echo {name}';
      const result = await resolveFlowParams(script, { name: 'from-flag' }, null, ['from-positional']);
      expect(result).toBe('echo from-flag');
    });

    it('prompts for remaining required params after positionals are exhausted', async () => {
      const script = 'cmd {first} {second}';
      const mockPrompt = async () => ({ second: 'prompted' });
      const result = await resolveFlowParams(script, {}, mockPrompt, ['positional']);
      expect(result).toBe('cmd positional prompted');
    });

    it('full flutter workflow: positional + flags + nullable', async () => {
      const script = 'flutter create {name} {--org=>com.example} ?{--platforms}';
      const result = await resolveFlowParams(script, { platforms: 'ios,android' }, null, ['demo']);
      expect(result).toBe('flutter create demo --org=com.example --platforms=ios,android');
    });
  });
});
