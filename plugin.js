// *********************************************************************
// Copyright 2018 Healthy Bytes Technology & Wellness
//
// A TSLint plugin for Brunch.

'use strict';

const debugMaker = require('debug');
const debug = debugMaker('tslint-brunch');

const path = require('path');

// Use the real TSLint library, or our mock library if we're testing.
let tslint;
if (! process.env.hasOwnProperty('TEST'))
{
  debug('Using real TSLint library');
  tslint = require('tslint');
}
else
{
  debug('Using mock TSLint library');
  tslint = require('./test/MockTslint');
}

class TSLinter
{
  // Construct the plugin with the entire Brunch config object.  We
  // will pick out our options from the plugins.tslint object.  The
  // following options fields are supported:
  //
  //   pattern:
  //     An anymatcher that matches all TypeScript files that should
  //     be processed by the linter.  Defaults to the regex:
  //     /^app/.*\.ts$/ .
  //
  //   root:
  //     The path at which to stop looking further back in the
  //     directory ancestry for TSLint config files when linting.
  //     This is analogous to ESLint's 'root' field in its config
  //     options.  This would typically be set to the root of your
  //     project.
  //
  //   config:
  //     Any options that may be found in tslint.json, in JavaScript
  //     notation rather than JSON notation.  These are used as the
  //     base config for all linting operations.  See the TSLint
  //     documentation for further details:
  //
  //       https://palantir.github.io/tslint/usage/configuration/
  //
  //   options:
  //     Global options for the linter, as defined by the TSLint
  //     ILinterOptions object.  These are equivalent to a subset of
  //     the TSLint CLI command line options, documented here:
  //
  //     https://palantir.github.io/tslint/usage/cli/
  //
  //     fix (boolean):
  //       False to only report on problems; true to attempt to fix
  //       them as well.  Defaults to false.
  //
  //     quiet (boolean):
  //       True to only report on errors; false to report on all
  //       problems.  Defaults to false.
  //
  //     formatter (string or FormatterConstructor function):
  //       The format in which problems are reported.  There are
  //       several builtin formatters that may be specified by string.
  //       If you wish to specify your own formatter, put it in a file
  //       in the specified formattersDirectory, or provide a
  //       TSLint FormatterConstructor function.  Defaults to 'prose'.
  //
  //     formattersDirectory (string):
  //       The directory in which to find the formatter definitions.
  //       If you specify a custom formatter whose definition doesn't
  //       reside in the builtin formatters directory, you must
  //       specify this to locate your customer formatter.  The
  //       builtin formatters are always considered first, and then
  //       this drectory will be considered.  Defaults to undefined.
  //
  //     rulesDirectory (string or string array):
  //       One or more directories containing custom rules.  The
  //       builtin rules are always considered first, then rules in
  //       these directories in the order provided.  Defaults to
  //       undefined.
  //
  constructor(brunchCfg)
  {
    // Find out plugin's options within the global Brunch plugin
    // configuration.
    const cfg = (brunchCfg && brunchCfg.plugins && brunchCfg.plugins.tslint
		 ? brunchCfg.plugins.tslint
		 : { config: {} });
    
    // Advertise to Brunch the types of files we will lint.  Use
    // the pattern supplied by the Brunch config, or use a typical
    // default.
    this.pattern = cfg.pattern || /^app\/.*\.ts$/;

    // TODO: Make sure the root is a directory.
    this.root = (cfg.root ? path.resolve(cfg.root) : path.set);
    
    // Our base config format matches the tslint.json form, only
    // it is in JavaScript object form.  This is the intermediate
    // form that TSLint uses when reading tslint.json files, but
    // before parsing them.  In order for our base config to be
    // applied properly on a per-file basis, we must get TSLint to
    // parse it.
    this.baseConfig = tslint.Configuration.parseConfigFile(cfg.config);

    // If the options object exists in cfg, and options has the given
    // field, return its value, otherwise return the given default value.
    function getOption(field, defaultValue)
    {
      if (typeof cfg.options === 'object'
	  && cfg.options.hasOwnProperty(field))
      {
	return cfg.options[field];
      }
      return defaultValue;
    }
    
    // Setup global options.
    const options =
    {
      // Are we fixing errors, or just reporting on them?
      fix: getOption('fix', false),

      // Emit all findings, or just errors?
      quiet: getOption('quiet', false),
      
      // How are errors being formatted?  The default 'prose'.  This
      // may be a formatter name, or a FormatterConstructor function.
      formatter: getOption('formatter', 'prose'),

      // Where can the formatter be found?
      formattersDirectory: getOption('formattersDirectory', undefined),

      // Where can the custom rules be found?  A string or array of strings.
      rulesDirectory: getOption('rulesDirectory', undefined)
    };

    // Construct the TSLint engine with the global options.
    this.linter = new tslint.Linter(options);
  }

  // Lint a single file.  Brunch provides the file as an object
  // containing the file's path and its contents (already read from
  // the filesystem).
  //
  // The base config set at construction is merged with any
  // tslint.json configurations found by TSLint for the given file.
  // The base config is given the lowest priority.
  //
  // Note that TSLint _doesn't_ recursively search up the given file's
  // directory tree looking for configuration files.  This differs
  // from other linters like ESLint.  We prefer the recrusive
  // application of config, so this function will combine all configs
  // found up the directory tree, with configuration "closer" to the
  // file being linted taking precedence.
  //
  // This returns a resolved Promise if linting was successful, and
  // returns a rejected Promise containing any results if linting
  // encountered errors.
  //
  lint(brunchFile)
  {
    const debugConfig = debugMaker('tslint-brunch:read-config');
    
    // Make a copy of the base config to start with.
    let mergedConfig = {};
    mergedConfig.defaultSeverity = this.baseConfig.defaultSeverity;
    mergedConfig.extends = Array.from(this.baseConfig.extends);
    mergedConfig.jsRules = new Map(this.baseConfig.jsRules);
    mergedConfig.rules = new Map(this.baseConfig.rules);
    mergedConfig.rulesDirectory = Array.from(this.baseConfig.rulesDirectory);

    // We expect the file being linted to live with our root.  If not,
    // we won't apply any config but the base one.
    const filePathAbs = path.resolve(brunchFile.path);
    if (! filePathAbs.startsWith(this.root))
    {
      debugConfig(`File ${filePathAbs} doesn't live within root ${this.root}; `
                  + 'using only base config');
    }
    else
    {
      // Strip our root off of the file's path, since we aren't going to
      // look for configs any further up than the root.
      let stripped = filePathAbs.slice(this.root.length);

      // Split that into dir parts.
      const split = stripped.split(path.sep);

      // Start at the outermost dir part and read configs, merging as
      // we work our way in to the innermost dir part.
      let configPath = this.root;
      for (const dirPart of split)
      {
        configPath += path.sep + dirPart;

        debugConfig(`Working in dir ${configPath}`);
        
        // Determine the config filename for the current dir.
        const configFile = tslint.Configuration.findConfigurationPath(
          // Specify undefined for the config filename to tell TSLint to
          // search for typical config files starting in the file's
          // directory and working back up the tree.
          undefined,
          configPath);
        
        if (configFile !== undefined)
        {
          // Load it.
          const loadedConfig =
            tslint.Configuration.loadConfigurationFromPath(configFile);

          debugConfig(`Loaded rules from ${configFile}:`);
          for (const entry of loadedConfig.rules.entries())
          {
            debugConfig(`  ${JSON.stringify(entry)}`);
          }
          
          // Merge it, giving ancestors less precedence as we go.
          mergedConfig = tslint.Configuration.extendConfigurationFile(mergedConfig, loadedConfig);

          debugConfig('Merged config rules:');
          for (const entry of mergedConfig.rules.entries())
          {
            debugConfig(`  ${JSON.stringify(entry)}`);
          }
        }
      }
    }
    
    debugConfig('Final config rules:');
    for (const entry of mergedConfig.rules.entries())
    {
      debugConfig(`  ${JSON.stringify(entry)}`);
    }

    // Perform the linting.
    this.linter.lint(brunchFile.path, brunchFile.data, mergedConfig);
    const result = this.linter.getResult();

    //debug(`Lint result: ${JSON.stringify(result)}`);

    if (result.errorCount === 0)
    {
      return Promise.resolve(true);
    }
    else
    {
      return Promise.reject(result.output);
    }
  }
}

// Tell Brunch that we are a plugin, and we handle code source files.
//
// Note that the presence of a lint() function on TSLinter tells
// Brunch that we're a linter.
//
TSLinter.prototype.brunchPlugin = true;
TSLinter.prototype.type = 'javascript';

module.exports = TSLinter;

// *********************************************************************
