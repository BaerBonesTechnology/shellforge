#!/usr/bin/env node


import boxen from 'boxen';
import chalk from 'chalk';
import childProcess from 'child_process';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import os from 'os';
import packageJson from '../package.json' with { type: "json" };
import path from 'path';
import util from 'util';
import yargs from 'yargs/yargs';

import {fileURLToPath} from 'url';
import { hideBin }  from 'yargs/helpers';
import { compareVersions as _compareVersions, resolveFlowParams as _resolveFlowParams } from './utils.js';
import {
  PACKAGE_NAME,
  ConfigKey,
  ScriptKey,
  ContentKey,
  Shell,
  ShellExt,
  ShellRunner,
  ShellRunnerArgs,
  Defaults,
  AnnouncementFilter,
  ReinitOption,
  ParamType,
  ScriptDisclosure,
} from './constants.js';

// tool used for stylization of the console output
const prettify = {
/** 
* @function formatError
* @function formatSuccess
* @function fotmatAnnouncement
* @function formatLink
* @function formatInfo
  */
  formatError(message) {
    return chalk.red(message);
  },
  formatSuccess(message) {
    return chalk.green(message);
  },
  formatAnnouncement(message) {
    const boxenOptions = {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
      backgroundColor: 'black'
    };
    return boxen(chalk.yellow(message), boxenOptions);
  },
  formatLink(message) {
    return chalk.blue.underline(message);
  },
  formatInfo(message) {
    return chalk.blue(message);
  }

} 

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigFile = path.join(__dirname, Defaults.configFile);
const userConfigDir = path.join(os.homedir(), Defaults.configDirName);
const configFile = path.join(userConfigDir, Defaults.configFile);
const executeCommand = util.promisify(childProcess.exec);
const executeFile = util.promisify(childProcess.execFile);


/**
 * Function that formats announcements for a specific version
 * @param {String} versionChoice the chosen version to view announcements for 
 * @returns 
 */
const announcements = async ({ versionChoice = packageJson.version }) => {
  try{
  const config = await loadConfig();

  await checkInit();

  if(versionChoice === AnnouncementFilter.list){
    return announcementVersionList();
  }
  
  console.log(prettify.formatInfo("Loading announcements for version: " + versionChoice))
  for (var i = 0; i < config[ConfigKey.announcements].length; i++) {
    if (config[ConfigKey.announcements][i][ContentKey.version] === versionChoice || versionChoice === AnnouncementFilter.all) {
      var announcementOutput = "Announcements for version: " + config[ConfigKey.announcements][i][ContentKey.version] + "\n";
      for(const message in config[ConfigKey.announcements][i][ContentKey.messages]){
        announcementOutput += "    - " + config[ConfigKey.announcements][i][ContentKey.messages][message] + "\n";
      }
      console.log(prettify.formatAnnouncement(announcementOutput));
    }
  }
} catch (error) {
  console.error(prettify.formatError("Error loading announcements:"), error.message);
}
}

/**
 * Function that asks user which version of the announcements they would like to view
 */
const announcementVersionList = async () => {
  const config = await loadConfig();

  await checkInit();

  const versionList = config[ConfigKey.announcements].map((announcement) => {
    return announcement[ContentKey.version];
  });
  versionList.push(AnnouncementFilter.all);

  const versionAnswer = await inquirer.prompt({
    type: "list",
    name: "version",
    message: "Select a version to view announcements for:",
    choices: versionList,
  }); 
  await announcements({ versionChoice: versionAnswer.version });
}

const checkInit = async () => {
  const config = await loadConfig();
  if (!config[ConfigKey.initialized]) {
    console.log(prettify.formatError(
      'Forge is not initialized. Please run "forge init" to initialize it.'
    ));
    process.exit(1);
  }
  return true;
}
/**
 * Function that checks for updates to shellforge
 **/
const checkForUpdates = async () => {
  try {
    const { stdout, stderr } = await executeCommand(
      `npm view ${PACKAGE_NAME} version`
    );
    const latestVersion = stdout.trim();

    if (compareVersions({latestVersion:latestVersion}) === true) {
      console.log(
        'A new version of shellforge is available.\nRun "forge update" to update and regenerate scripts\nor\n"npm i -g shellforge" to update only the CLI.'
      );
    }
  } catch (error) {
    // Network unavailable or npm not reachable — skip update check
  }
};

/**
 * Function that checks the script for the current version
 * @param {String} scriptFile Path to the script file
 * @returns {Boolean} True if the script needs to be updated, otherwise false
 */
const checkScriptForVersion = async (scriptFile) => {
  const currentVersion = packageJson.version;
  const scriptContent = await fs.readFile(scriptFile, "utf-8");
  if (!scriptContent.includes(PACKAGE_NAME + " " + currentVersion)) {
    const prompt = await inquirer.prompt({
      type: "confirm",
      name: "update",
      message:
        prettify.formatAnnouncement("This script was generated by an older version of shellforge, and possibly wont display command output. Would you like to update your script?"),
      default: true,
    });
    return prompt.update;
  }
};

/**
 * Function that clears all scripts
 */
const clear = async () => {
  //remove all scripts
  const scripts = await loadScripts();
  for (const entry of scripts) {
    console.log("Deleting script: " + entry[ScriptKey.name]);
    await deleteScript(entry[ScriptKey.name]);
  }
};

/**
 * Function that breaks down and compares the latest version with the current version between major, mid, and minor versions
 * @param {String}latestVersion latest Version available 
 * @returns 
 */
const compareVersions = ({latestVersion = packageJson.version}) => {
  return _compareVersions(latestVersion, packageJson.version);
}

/**
/**
 * Resolves {param}, ?{param}, and {param==default} placeholders in script content.
 * Delegates to utils.js, passing inquirer.prompt as the prompt function.
 */
const resolveScriptParams = async (scriptContent, cliArgs = {}, positionalArgs = []) => {
  return _resolveFlowParams(scriptContent, cliArgs, async (questions) => {
    const paramNames = questions.map(q => q.name);
    console.log(prettify.formatInfo(
      `This script requires parameter(s): ${paramNames.map(n => "{" + n + "}").join(", ")}`
    ));
    return inquirer.prompt(questions);
  }, positionalArgs);
};

/**
 * Function that creates a new script.
 * @param {String} scriptName Name of the script.
 * @param {String} scriptPath Target path of the script. 
 * @param {String} commands Commands to run.
 */
const createScript = async (scriptName, scriptPath, commands) => {
  let scriptContent = "";
  let scriptFileExtension = "";
  const config = await loadConfig();

  const version = packageJson.version;
  const bashDisclosure = ScriptDisclosure.bash(version);
  const batDisclosure = ScriptDisclosure.bat(version);
  const ps1Disclosure = ScriptDisclosure.ps1(version);

  // Split on commas that are outside {…} placeholders
  const splitCommands = (str) => {
    const parts = [];
    let current = '';
    let depth = 0;
    for (const ch of str) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current) parts.push(current);
    return parts.filter(p => p.trim() !== '').join('\n');
  };

  switch (config[ConfigKey.terminalProfile]) {
    case Shell.bash:
      scriptContent = `#!/bin/bash\nset -e\n\n${bashDisclosure}\n${splitCommands(commands)}`;
      scriptFileExtension = ShellExt.sh;
      break;
    case Shell.zsh:
      scriptContent = `#!/bin/zsh\nset -e\n\n${bashDisclosure}\n${splitCommands(commands)}`;
      scriptFileExtension = ShellExt.sh;
      break;
    case Shell.powershell:
      scriptContent = `$ErrorActionPreference = "Stop"\n\n${ps1Disclosure}\n${splitCommands(commands)}`;
      scriptFileExtension = ShellExt.ps1;
      break;
    case Shell.cmd:
      scriptContent = `@echo off\n\n${batDisclosure}\n${splitCommands(commands).replaceAll(
        '\n',
        '\nif %errorlevel% neq 0 exit /b %errorlevel%\n'
      )}`;
      scriptFileExtension = ShellExt.bat;
      break;
    default:
      console.log(prettify.formatError("Invalid terminal profile selected."));
      return;
  }
  const commandFolder = path.join(config[ConfigKey.scriptCommandDir], scriptName);

  try {
    await fs.mkdir(commandFolder, { recursive: true });
    const scriptFile = path.join(commandFolder, `${Defaults.scriptBaseName}${scriptFileExtension}`);
    await fs.writeFile(scriptFile, scriptContent);

    const scripts = await loadScripts();
    scripts.push({
      [ScriptKey.name]: scriptName,
      [ScriptKey.path]: scriptPath,
      [ScriptKey.script]: scriptFile,
    });

    await saveScripts(scripts);

    console.log(prettify.formatSuccess("Script created successfully!"));
  } catch (error) {
    console.error(prettify.formatError("Error creating script:"), error.message);
  }
};


/**
 * Interactive command builder — walks the user through building commands
 * with typed parameters one at a time, then returns the final comma-separated string.
 * @returns {String} Comma-separated command string ready for createScript
 */
const buildCommands = async () => {
  const commands = [];

  let addMore = true;
  while (addMore) {
    const { baseCommand } = await inquirer.prompt({
      type: "input",
      name: "baseCommand",
      message: "Enter the base command (e.g. flutter create, git push):",
      validate: (v) => v.trim() !== "" || "Command cannot be empty",
    });

    const params = [];
    let addParam = true;
    while (addParam) {
      const { wantParam } = await inquirer.prompt({
        type: "confirm",
        name: "wantParam",
        message: "Add a parameter?",
        default: true,
      });

      if (!wantParam) {
        addParam = false;
        break;
      }

      const { paramName } = await inquirer.prompt({
        type: "input",
        name: "paramName",
        message: "Parameter name (e.g. name, --org, --platforms):",
        validate: (v) => v.trim() !== "" || "Parameter name cannot be empty",
      });

      const { paramType } = await inquirer.prompt({
        type: "list",
        name: "paramType",
        message: `Type for ${paramName}:`,
        choices: [
          { name: "Required  — must be provided at runtime\n", value: ParamType.required },
          { name: "Optional  — uses a default value if not provided\n", value: ParamType.optional },
          { name: "Nullable  — removed entirely if not provided\n", value: ParamType.nullable },
        ],
      });

      if (paramType === ParamType.optional) {
        const { defaultValue } = await inquirer.prompt({
          type: "input",
          name: "defaultValue",
          message: `Default value for ${paramName}:`,
        });
        params.push(`{${paramName}=>${defaultValue}}`);
      } else if (paramType === ParamType.nullable) {
        params.push(`?{${paramName}}`);
      } else {
        params.push(`{${paramName}}`);
      }
    }

    const fullCommand = [baseCommand.trim(), ...params].join(" ");
    console.log(prettify.formatInfo(`  → ${fullCommand}`));
    commands.push(fullCommand);

    const { another } = await inquirer.prompt({
      type: "confirm",
      name: "another",
      message: "Add another command?",
      default: false,
    });
    addMore = another;
  }

  return commands.join(",");
};

/**
 * Function that prompts the user to create a new script
 * @param {Boolean} tutorialRunning Checks if the tutorial is running, defaults to false
 */
const createScriptWithPrompt = async ({ tutorialRunning = false }) => {
  await checkForUpdates();

  const config = await loadConfig();

await checkInit();

  if (tutorialRunning) {
    console.log(prettify.formatAnnouncement(config[ConfigKey.tutorial][ContentKey.steps][2][ContentKey.subSteps][0][ContentKey.output]));
  }

  const questions = [
    {
      type: "input",
      name: "scriptName",
      message: "Enter script name:",
      validate: async (value) => {
        try {
          // check if script name is valid (only alphanumeric, underscore, and dash allowed)
          if (/^([a-zA-Z0-9_-]*)$/.test(value) !== true) {
            return "Please enter a valid script name";
          }
          //check if script name already exists
          const scripts = await loadScripts();
          const entry =
            scripts !== null ? scripts.find((s) => s.name === value) : null;
          if (entry) {
            return "Script name already exists";
          }
          return true;
        } catch (error) {
          return "An Error Occurred: " + error.message;
        }
      },
    },
    {
      type: "input",
      name: "scriptPath",
      message: "Enter the path where the script will be called from:",
      default: path.join(process.cwd(), config[ConfigKey.defaultScriptPath]),
      filter: (value) => resolveTilde(value.trim()),
      validate: async (value) => {
        try {
          const stats = await fs.stat(value);
          return stats.isDirectory() || "Please enter a valid directory path";
        } catch (error) {
          return "Please enter a valid path";
        }
      },
    },
  ];

  const answers = await inquirer.prompt(questions);
  var { scriptName, scriptPath } = answers;

  let commands;
  if (tutorialRunning) {
    // Keep simple input for the tutorial
    const { rawCommands } = await inquirer.prompt({
      type: "input",
      name: "rawCommands",
      message: "Here We do a little scripting, input whatever you want or try 'echo \"Hello World!\":\n ",
      validate: (v) => v !== "" || "Please enter at least one command",
    });
    commands = rawCommands;
  } else {
    commands = await buildCommands();
  }

  if (!commands.endsWith(",")) {
    commands += ",";
  }

  createScript(scriptName, scriptPath, commands);

  if (tutorialRunning) {
    console.log(prettify.formatAnnouncement(config[ConfigKey.tutorial][ContentKey.steps][2][ContentKey.subSteps][0][ContentKey.finished]));
  }
};

/**
 * Function that deletes a script
 * @param {String} scriptName Name of the script to be deleted
 */
const deleteScript = async (scriptName) => {
  await checkForUpdates();

  const config = await loadConfig();

await checkInit();

  const scripts = await loadScripts();
  const scriptIndex = scripts.findIndex((s) => s[ScriptKey.name] === scriptName);

  if (scriptIndex === -1) {
    console.log("Script not found");
    return;
  }

  const entry = scripts[scriptIndex];

  try {
    scripts.splice(scriptIndex, 1);
    await saveScripts(scripts);
    const commandFolder = path.dirname(entry[ScriptKey.script]);
    await fs.rm(commandFolder, { recursive: true });
    console.log("Script deleted successfully!");
  } catch (error) {
    console.error("Error deleting script:", error.message);
  }
};

/**
 * Function that initializes the script manager
 */
const initialize = async () => {
  const config = await loadConfig();
  if (config[ConfigKey.initialized]) {
    console.log(prettify.formatInfo("ShellForge is already initialized!"));
  }

  var tutorialAnswer = false;

  console.log(prettify.formatAnnouncement(config[ConfigKey.initMessages]));
  if (!config[ConfigKey.initialized]) {
    tutorialAnswer = await inquirer.prompt({
      type: "confirm",
      name: "tutorial",
      message: config[ConfigKey.tutorial][ContentKey.steps][0][ContentKey.message],
      default: true,
    });

    if (tutorialAnswer.tutorial) {
      console.clear();
      console.log(prettify.formatAnnouncement(config[ConfigKey.tutorial][ContentKey.steps][1][ContentKey.message]));
    }
  }

  await checkForUpdates();

  const terminalProfileAnswer = await inquirer.prompt({
    type: "list",
    name: "terminalProfile",
    message: "Select your terminal profile:",
    choices: Shell.all,
    default: Shell.bash,
  });

  const scriptLocationAnswer = await inquirer.prompt({
    type: "input",
    name: "scriptLocation",
    message: "Enter the path where scripts will be stored:",
    default: config[ConfigKey.scriptDir].replace(Defaults.userHomePlaceholder, os.homedir()),
  });

  config[ConfigKey.terminalProfile] = terminalProfileAnswer.terminalProfile;
  config[ConfigKey.scriptDir] = scriptLocationAnswer.scriptLocation;
  config[ConfigKey.scriptCommandDir] = path.join(config[ConfigKey.scriptDir], Defaults.commandsDirName);
  config[ConfigKey.initialized] = true;

  await saveConfig(config);
  console.log(prettify.formatSuccess("ShellForge initialized successfully!"));

  if (tutorialAnswer.tutorial) {
    console.clear();
    console.log(prettify.formatAnnouncement(config[ConfigKey.tutorial][ContentKey.steps][2][ContentKey.message]));
    createScriptWithPrompt({tutorialRunning:true});
  }
}


/**
 * Function that lists all scripts available
 */
const listScripts = async () => {
  const config = await loadConfig();

await checkInit();

  const scripts = await loadScripts();
  if (scripts.length === 0) {
    console.log("No scripts found.");
  } else {
    console.log("List of scripts:");
    scripts.forEach((entry) => {
      console.log(entry[ScriptKey.name]);
    });
  }
};


/**
 * Resolves ~ to the user's home directory in a path string.
 */
const resolveTilde = (p) => {
  if (typeof p !== 'string') return p;
  // Expand ~ to home directory
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  // Expand $HOME (unix) and %USERPROFILE% (windows)
  p = p.replace(/\$HOME\b/g, os.homedir());
  p = p.replace(/%USERPROFILE%/gi, os.homedir());
  return p;
};

/**
 * Loads user configuration from the config.json file.
 * Copies default config to user home directory on first run.
 */
const loadConfig = async () => {
  try {
    try {
      await fs.access(configFile);
    } catch {
      await fs.mkdir(userConfigDir, { recursive: true });
      await fs.copyFile(defaultConfigFile, configFile);
    }
    const configData = await fs.readFile(configFile, "utf-8");
    const config = JSON.parse(configData);
    if (config[ConfigKey.scriptDir]) config[ConfigKey.scriptDir] = resolveTilde(config[ConfigKey.scriptDir]);
    if (config[ConfigKey.scriptCommandDir]) config[ConfigKey.scriptCommandDir] = resolveTilde(config[ConfigKey.scriptCommandDir]);
    return config;
  } catch (error) {
    throw new Error("Failed to load config.json: " + error.message);
  }
};

/**
 * Loads all scripts from the scripts.json file
 * @returns {Array} Array of scripts
 */
const loadScripts = async () => {
  try {
    const config = await loadConfig();
    const scriptsFile = path.join(config[ConfigKey.scriptDir], Defaults.scriptsFile);

    if (
      !(await fs
        .access(scriptsFile)
        .then(() => true)
        .catch(() => false))
    ) {
      return [];
    }

    const scriptsData = await fs.readFile(scriptsFile, "utf-8");
    const scripts = JSON.parse(scriptsData);
    return scripts.map((s) => ({
      ...s,
      [ScriptKey.path]: s[ScriptKey.path] ? resolveTilde(s[ScriptKey.path]) : s[ScriptKey.path],
      [ScriptKey.script]: s[ScriptKey.script] ? resolveTilde(s[ScriptKey.script]) : s[ScriptKey.script],
    }));
  } catch (error) {
    console.error("Error loading scripts:", error.message);
    return [];
  }
};

/**
 * Function that opens a script for editing through vs code and backups to default text openCommand if vs code cli is not installed.
 * @param {String} scriptName Script wanting to retrieve/edit. 
 */
const openScriptForEditing = async (scriptName, openCommand = undefined, path = undefined) => {
  const config = await loadConfig();

await checkInit();

if(openCommand||path){
  // either openCommand or path is empty
  try{
  const validate = ((openCommand === undefined && path !== "") || (openCommand !== "" && path === undefined))
  if(!validate){
    throw new Error("Please provide either the openCommand or the path to the openCommand executable, but not both.")
  }

  if(openCommand !== undefined){
    config[ConfigKey.defaultTextEditorCommand] = openCommand;
    config[ConfigKey.defaultTextEditorPath] = null;
  }
  if(path !== undefined){
    config[ConfigKey.defaultTextEditorCommand] = null;
    config[ConfigKey.defaultTextEditorPath] = path;
  }

  await saveConfig(config);
 } catch (error) {
    console.error(prettify.formatError("Error opening script for editing:"), error.message);
    return;
  }
}

  const scripts = await loadScripts();
  const entry = scripts.find((s) => s[ScriptKey.name] === scriptName);

  if (!entry) {
    console.log("Script not found");
    return;
  }

  const currentDir = process.cwd();
  process.chdir(entry[ScriptKey.path]);

  console.log("Opening script for editing: " + entry[ScriptKey.name]);

  try {
    const { stdout, stderr } = await executeCommand(`${config[ConfigKey.defaultTextEditorCommand] ?? config[ConfigKey.defaultTextEditorPath]} ${entry[ScriptKey.script]}`);

    if (stderr) {
      console.error(stderr);
    }
    console.log(stdout);
  } catch (error) {
    try {
      switch (config[ConfigKey.terminalProfile]) {
        case Shell.bash:
        case Shell.zsh:
          await executeCommand(`${Defaults.fallbackEditorUnix} ${entry[ScriptKey.script]}`);
          break;
        case Shell.powershell:
        case Shell.cmd:
          await executeCommand(`${Defaults.fallbackEditorWindows} ${entry[ScriptKey.script]}`);
          break;
      }
    } catch (error) {
      console.error("Error opening script for editing:", error.message);
    }
  } finally {
    process.chdir(currentDir);
    console.log(prettify.formatSuccess("Finished."));
  }
};

/**
 * Function that re-initializes the script manager
 */
const reinitialize = async () => {
  await checkForUpdates();

  // give user option to move scripts to new location, or delete them, or cancel
  // if move, ask for new location
  // if delete, delete scripts and ask for new location
  // if cancel, cancel

  const COMPLETED_MOVE = "Scripts moved successfully!\n\nNew location:";
  const config = await loadConfig();

  //check if existing scripts exist
  const scripts = await loadScripts();
  if (scripts.length > 0) {
    const verificationAnswer = await inquirer.prompt({
      type: "list",
      name: "verification",
      message:
        "You are about to reinitialize ShellForge. What would you like to do with existing scripts?",
      choices: ReinitOption.all,
      default: ReinitOption.move,
    });

    switch (verificationAnswer.verification) {
      case ReinitOption.move:
        const newScriptLocationAnswer = await inquirer.prompt({
          type: "input",
          name: "scriptLocation",
          message: "Enter the path where scripts will be stored:",
          default: config[ConfigKey.scriptDir].replace(Defaults.userHomePlaceholder, os.homedir()),
        });
        try {
          await fs.cp(config[ConfigKey.scriptDir], newScriptLocationAnswer.scriptLocation, { recursive: true });
          await fs.rm(config[ConfigKey.scriptDir], { recursive: true });
          console.log(`${COMPLETED_MOVE}${newScriptLocationAnswer.scriptLocation}`);
        } catch (error) {
          console.error(prettify.formatError("Error moving scripts:"), error.message);
          return;
        }
        //update config
        config[ConfigKey.scriptDir] = newScriptLocationAnswer.scriptLocation;
        config[ConfigKey.scriptCommandDir] = path.join(config[ConfigKey.scriptDir], Defaults.commandsDirName);
        config[ConfigKey.initialized] = true;
        await saveConfig(config);
        break;
      case ReinitOption.delete:
        try {
          await fs.rm(config[ConfigKey.scriptDir], { recursive: true });
        } catch (error) {
          console.error(prettify.formatError("Error deleting scripts:"), error.message);
          return;
        }

        //update config
        config[ConfigKey.initialized] = false;
        await saveConfig(config);

        //reinitialize
        await initialize();
        break;
      case ReinitOption.cancel:
        return;
    }
  }
};

/**
 * Function that resets the config
 */
const resetConfig = async () => {
  const config = await loadConfig();
  config[ConfigKey.scriptDir] = path.join(os.homedir(), Defaults.scriptDirName);
  config[ConfigKey.scriptCommandDir] = path.join(config[ConfigKey.scriptDir], Defaults.commandsDirName);
  config[ConfigKey.terminalProfile] = Shell.bash;
  config[ConfigKey.defaultScriptPath] = Defaults.scriptPath;
  config[ConfigKey.initialized] = false;
  await saveConfig(config);
};

/**
 * Function that runs a script
 * @param {String} scriptName Name of the script to be run
 */
const runScript = async (scriptName, cliArgs = {}, positionalArgs = []) => {
  await checkForUpdates();

  const scripts = await loadScripts();
  var entry = scripts.find((s) => s[ScriptKey.name] === scriptName);

  if(!entry) {
    console.log(prettify.formatError("Script not found"));
    return;
  }

  const config = await loadConfig();

await checkInit();

  if (!entry) {
    console.log("Script not found");
    return;
  }

  const currentDir = process.cwd();
  process.chdir(entry[ScriptKey.path]);

  console.log("Running script: " + entry[ScriptKey.name]);

  // Read the script and resolve any {param} placeholders
  let scriptContent = await fs.readFile(entry[ScriptKey.script], "utf-8");
  const hasParams = /(?:\?\{|\{-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*=>?|(?<!\?)\{-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*\})/.test(scriptContent);
  let scriptToRun = entry[ScriptKey.script];

  if (hasParams) {
    scriptContent = await resolveScriptParams(scriptContent, cliArgs, positionalArgs);
    // Write resolved script to a temp file
    const ext = path.extname(entry[ScriptKey.script]);
    scriptToRun = path.join(path.dirname(entry[ScriptKey.script]), `${Defaults.tempRunPrefix}${ext}`);
    await fs.writeFile(scriptToRun, scriptContent);
  }

  var shellRunner;
  var shellArgs;
  switch (config[ConfigKey.terminalProfile]) {
    case Shell.bash:
    case Shell.zsh:
      shellRunner = ShellRunner.sh;
      shellArgs = [scriptToRun];
      break;
    case Shell.powershell:
      shellRunner = ShellRunner.powershell;
      shellArgs = [ShellRunnerArgs.powershellFile, scriptToRun];
      break;
    case Shell.cmd:
      shellRunner = ShellRunner.cmd;
      shellArgs = [ShellRunnerArgs.cmdExec, scriptToRun];
      break;
    default:
      console.log("Invalid terminal profile selected.");
      return;
  }

  try {
    await new Promise((resolve, reject) => {
      const child = childProcess.spawn(shellRunner, shellArgs, {
        stdio: 'inherit',
        cwd: entry[ScriptKey.path],
      });
      child.on('close', (code, signal) => {
        if (signal === 'SIGINT' || signal === 'SIGTERM' || code === 130) {
          resolve();
        } else if (code !== 0) {
          reject(new Error(`Script exited with code ${code}`));
        } else {
          resolve();
        }
      });
      child.on('error', reject);
    });
  } catch (error) {
    console.error("Error running script:", error.message);
  } finally {
    if (hasParams && scriptToRun !== entry[ScriptKey.script]) {
      await fs.rm(scriptToRun, { force: true }).catch(() => {});
    }
    process.chdir(currentDir);
    console.log("Finished.");
  }
};

/**
 * Function that saves the user configuration to the config.json file
 * @param {Object} config Configuration object to be saved
 */
const saveConfig = async (config) => {
  try {
    await fs.mkdir(userConfigDir, { recursive: true });
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error("Failed to save config.json: " + error.message);
  }
};

/**
 * Function that saves the scripts to the scripts.json file
 * @param {Array} scripts Array of scripts to be saved
 */
const saveScripts = async (scripts) => {
  const config = await loadConfig();
  const scriptsFile = path.join(config[ConfigKey.scriptDir], Defaults.scriptsFile);

  try {
    await fs.writeFile(scriptsFile, JSON.stringify(scripts, null, 2));
  } catch (error) {
    console.error("Error saving scripts:", error.message);
  }
};


/**
 * Function that updates shellforge
 */
const update = async () => {
  //get current config
  const config = await loadConfig();

  //update shellforge
  const { stdout, stderr } = await executeCommand(
    `npm i -g ${PACKAGE_NAME} | grep -q "Error" && exit 1 || exit 0`
  );
  console.log(stdout);
  if (stderr) {
    console.error(stderr);
  }

  // get scripts and update them
  const scripts = await loadScripts();
  for (const entry of scripts) {
    const scriptFile = entry[ScriptKey.script];
    var scriptContent = await fs.readFile(scriptFile, "utf-8");
    // Update from v0.0.3 to v1.0.0
    //replace shebang with blank
    scriptContent = scriptContent.replace(/#.*\n\n/, "");
    //replace shebang and disclosure with blank
    scriptContent = scriptContent.replace(/#.*\n\n.*\n\n####/, "");
    if (
      !scriptContent.includes(
        '| tee -a /dev/tty | grep -q "Error" && exit 1 || exit 0\n\n'
      )
    ) {
      // replace '\n\n' with ','
      scriptContent = scriptContent.replaceAll("\n\n", ",");
      if (!scriptContent.endsWith(",")) {
        scriptContent += ",";
      } else {
        continue;
      }
      await createScript(entry[ScriptKey.name], entry[ScriptKey.path], scriptContent);
    }

    await saveConfig(config);
    // log success and any breaking changes needed to be made.
    console.log("ShellForge updated successfully!");
    console.log(
      "Please check for any breaking changes in the latest version and update your scripts accordingly.:\nhttps://github.com/BaerBonesTechnology/shellforge/releases"
    );
  }
};

/**
 * Developer function that views the config
 */
const viewConfig = async () => {
  const config = await loadConfig();
  console.log(config);
};

/**
 * Command Manager for shellforge
 */
yargs(hideBin(process.argv))
  .scriptName("forge")
  .command("init", "Initialize ShellForge", {}, initialize)
  .command("create", "Create a new script", {}, createScriptWithPrompt)
  .command("list", "List all scripts", {}, listScripts)
  .command("run <scriptName>", "Run a script by name.\nPass script parameters as flags: --paramName value", (yargs) => {
    yargs.positional("scriptName", {
      type: "string",
      describe: "The name of the script to run",
    })
    .strict(false)
  }, (argv) => {
    const { scriptName, _, $0, ...cliArgs } = argv;
    // _ contains positional args after scriptName (e.g. forge run myScript example)
    const positionalArgs = _.slice(1);
    runScript(scriptName, cliArgs, positionalArgs);
  })
  .command("delete <scriptName>", "Delete a script by name", {}, (argv) =>
    deleteScript(argv.scriptName)
  )
  .command("reinit", "Reinitialize ShellForge", {}, reinitialize)
  .command("edit <scriptName>", "Open a script for editing\n" + prettify.formatInfo("--openCommand, --o") + " Change default editor command\n" + prettify.formatInfo("--path, -p") +" Change default text editor path\n\n", (yargs) => {
    yargs.positional("scriptName", {
      type: "string",
      describe: "The name of the script to open for editing",
    })
    .option("openCommand", {
      alias: "o",
      type: "string",
      describe: "The name of the editor to use"
    })
    .option("path", {
      alias: "p",
      type: "string",
      describe: "The path of the editor executable to open for editing"
    })
  }, (argv) =>
    openScriptForEditing(argv.scriptName, argv.openCommand, argv.path)
  )
  .command("default", "Reset the config", {}, resetConfig)
  .command("config", "View the config", {}, viewConfig)
  .command("update", "Update ShellForge", {}, update)
  .command("clear", "Clear all scripts", {}, clear)
  .command("news", "View announcements\n" + prettify.formatInfo("--versionChoice, -v") +" choose version\n\n", (yargs) => {
    yargs.option('versionChoice', {
      alias: 'v',
      type: 'string',
      default: AnnouncementFilter.list,
      describe: 'The version of the announcements you would like to view. Type "LIST" to view all versions available.'
    })
  }, ({versionChoice}) => announcements({versionChoice:versionChoice}))
  .command("v", "version", {}, () => {
    console.log(packageJson.version);
  })
  .command("version", "version", {}, () => {
    console.log(packageJson.version);
  })
  .demandCommand()
  .help().argv;