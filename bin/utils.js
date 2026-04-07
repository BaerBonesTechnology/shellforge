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
 * Extracts parameter placeholders from script content, resolves them from
 * CLI args or interactive prompts, and returns the resolved script.
 *
 * Syntax:
 *   {paramName}            — Required: prompted if not passed via CLI
 *   ?{paramName}           — Nullable: removed silently if not passed via CLI
 *   {paramName==default}   — Optional: uses default value if not passed via CLI
 *
 * @param {String} scriptContent The raw script content with param placeholders
 * @param {Object} cliArgs Key-value pairs passed via CLI
 * @param {Function} promptFn Called with array of questions when prompting is needed
 * @returns {String} Script content with all placeholders replaced
 */
export const resolveFlowParams = async (scriptContent, cliArgs = {}, promptFn = null) => {
  const requiredPattern = /(?<!\?)\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const nullablePattern = /\?\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const optionalPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)==(.*?)\}/g;

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

  for (const name of requiredNames) {
    if (cliArgs[name] !== undefined) {
      resolved[name] = String(cliArgs[name]);
    } else {
      needsPrompt.push(name);
    }
  }

  for (const name of optionalNames) {
    if (cliArgs[name] !== undefined) {
      resolved[name] = String(cliArgs[name]);
    } else {
      resolved[name] = optionalDefaults[name];
    }
  }

  for (const name of nullableNames) {
    if (cliArgs[name] !== undefined) {
      resolved[name] = String(cliArgs[name]);
    } else {
      resolved[name] = "";
    }
  }

  if (needsPrompt.length > 0) {
    if (!promptFn) {
      throw new Error(`Missing required parameters: ${needsPrompt.join(", ")}`);
    }
    const questions = needsPrompt.map((name) => ({
      type: "input",
      name,
      message: `Enter value for {${name}}:`,
      validate: (value) => value !== "" || `A value is required for {${name}}`,
    }));
    const answers = await promptFn(questions);
    Object.assign(resolved, answers);
  }

  let result = scriptContent;

  for (const name of optionalNames) {
    const escapedDefault = optionalDefaults[name].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\{${name}==${escapedDefault}\\}`, 'g');
    result = result.replace(pattern, resolved[name]);
  }

  for (const name of nullableNames) {
    result = result.replaceAll(`?{${name}}`, resolved[name]);
  }

  for (const name of requiredNames) {
    result = result.replaceAll(`{${name}}`, resolved[name]);
  }

  return result;
};
