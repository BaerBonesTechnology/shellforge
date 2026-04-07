/**
 * Pure/testable utility functions for scriptflow-cli.
 * Extracted so they can be imported without triggering yargs or side effects.
 */

/**
 * Compares latest version against current version numerically.
 * @param {String} latestVersion The latest available version
 * @param {String} currentVersion The current installed version
 * @returns {Boolean} True if latestVersion is newer
 */
export const compareVersions = (latestVersion, currentVersion) => {
  if (latestVersion === currentVersion) return false;

  const latest = latestVersion.split(".").map(Number);
  const current = currentVersion.split(".").map(Number);

  if (latest[0] > current[0]) return true;
  if (latest[0] === current[0] && latest[1] > current[1]) return true;
  if (latest[0] === current[0] && latest[1] === current[1] && latest[2] > current[2]) return true;

  return false;
};

/**
 * Strips leading dashes from a parameter name to derive the CLI arg key.
 * e.g. "--org" → "org", "-v" → "v", "name" → "name"
 */
const toCliKey = (name) => name.replace(/^-+/, '');

/**
 * Formats a resolved value for output. Flag-style params (starting with -)
 * auto-insert "=" between the flag and value: --org + value → --org=value.
 * Plain params just return the value as-is.
 */
const formatValue = (name, value) => {
  if (value === "") return "";
  return name.startsWith('-') ? `${name}=${value}` : value;
};

/**
 * Extracts parameter placeholders from script content, resolves them from
 * CLI args or interactive prompts, and returns the resolved script.
 *
 * Syntax:
 *   {paramName}              — Required: prompted if not passed via CLI
 *   ?{paramName}             — Nullable: removed silently if not passed via CLI
 *   {paramName=>default}     — Optional: uses default value if not passed via CLI
 *
 * Flag-style params (prefixed with - or --) auto-insert "=" in the output:
 *   {--org=>com.example}     → --org=com.example
 *   ?{--platforms}           → --platforms=value  or  removed entirely
 *
 * @param {String} scriptContent The raw script content with param placeholders
 * @param {Object} cliArgs Key-value pairs passed via CLI (named flags)
 * @param {Function} promptFn Called with array of questions when prompting is needed
 * @param {Array} positionalArgs Positional CLI values mapped in order to non-flag required params
 * @returns {String} Script content with all placeholders replaced
 */
export const resolveFlowParams = async (scriptContent, cliArgs = {}, promptFn = null, positionalArgs = []) => {
  const requiredPattern = /(?<!\?)\{(-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*)\}/g;
  const nullablePattern = /\?\{(-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*)\}/g;
  const optionalPattern = /\{(-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*)=>?(.*?)\}/g;

  const requiredMatches = [...scriptContent.matchAll(requiredPattern)];
  const nullableMatches = [...scriptContent.matchAll(nullablePattern)];
  const optionalMatches = [...scriptContent.matchAll(optionalPattern)];

  if (requiredMatches.length === 0 && nullableMatches.length === 0 && optionalMatches.length === 0) {
    return scriptContent;
  }

  const requiredNames = [...new Set(requiredMatches.map((m) => m[1]))];
  const nullableNames = [...new Set(nullableMatches.map((m) => m[1]))];
  const optionalDefaults = {};
  for (const m of optionalMatches) {
    optionalDefaults[m[1]] = m[2];
  }
  const optionalNames = [...new Set(Object.keys(optionalDefaults))];

  const resolved = {};
  const needsPrompt = [];

  // Non-flag required params can be filled by positional args in order
  const positionalQueue = [...positionalArgs];

  for (const name of requiredNames) {
    const key = toCliKey(name);
    if (cliArgs[key] !== undefined) {
      resolved[name] = String(cliArgs[key]);
    } else if (!name.startsWith('-') && positionalQueue.length > 0) {
      resolved[name] = String(positionalQueue.shift());
    } else {
      needsPrompt.push(name);
    }
  }

  for (const name of optionalNames) {
    const key = toCliKey(name);
    if (cliArgs[key] !== undefined) {
      resolved[name] = String(cliArgs[key]);
    } else {
      resolved[name] = optionalDefaults[name];
    }
  }

  for (const name of nullableNames) {
    const key = toCliKey(name);
    if (cliArgs[key] !== undefined) {
      resolved[name] = String(cliArgs[key]);
    } else {
      resolved[name] = "";
    }
  }

  if (needsPrompt.length > 0) {
    if (!promptFn) {
      const displayNames = needsPrompt.map((n) => toCliKey(n));
      throw new Error(`Missing required parameters: ${displayNames.join(", ")}`);
    }
    const questions = needsPrompt.map((name) => ({
      type: "input",
      name: toCliKey(name),
      message: `Enter value for {${name}}:`,
      validate: (value) => value !== "" || `A value is required for {${name}}`,
    }));
    const answers = await promptFn(questions);
    for (const name of needsPrompt) {
      resolved[name] = answers[toCliKey(name)];
    }
  }

  let result = scriptContent;

  for (const name of optionalNames) {
    const escapedDefault = optionalDefaults[name].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\{${escapedName}=>?${escapedDefault}\\}`, 'g');
    result = result.replace(pattern, formatValue(name, resolved[name]));
  }

  for (const name of nullableNames) {
    result = result.replaceAll(`?{${name}}`, formatValue(name, resolved[name]));
  }

  for (const name of requiredNames) {
    result = result.replaceAll(`{${name}}`, formatValue(name, resolved[name]));
  }

  return result;
};
