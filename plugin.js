// *********************************************************************
// Copyright 2018 Healthy Bytes Technology & Wellness
//
// A TSLint plugin for Brunch.

'use strict';

const debug = require('debug')('brunch:tslint');
const fs = require('fs');
const path = require('path');

// Use the real TSLint library, or our mock library if we're testing.
let tslint;
if (! process.env.hasOwnProperty('TEST'))
{
  tslint = require('tslint');
}
else
{
  debug('Using mock TSLint library');
  tslint = require('./test/MockTslint');
}

class TSLinter
{
  // Construct the plugin with the entire Brunch config object.  We will pick
  // out our options from the plugins.tslint object.  See README.md for
  // documentation of the options.
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
    if (cfg.hasOwnProperty('pattern'))
    {
      if (! (cfg.pattern instanceof RegExp))
      {
        this.pattern = new RegExp(cfg.pattern);
      }
      else
      {
        this.pattern = cfg.pattern;
      }
    }
    else
    {
      this.pattern = /^app\/.*\.ts$/;
    }
    
    // Start with a root of '/'.
    this.root = path.sep;
    if (cfg.root)
    {
      // If a root was given, make sure the root is a directory.
      const root = path.resolve(cfg.root);
      try
      {
        if (fs.statSync(root).isDirectory())
        {
          this.root = root;
        }
      }
      catch (error) {}

      if (this.root !== root)
      {
        debug(`Ignoring non-directory root=${root}`);
      }
    }
    
    // Our base config format matches the tslint.json form, only
    // it is in JavaScript object form.  This is the intermediate
    // form that TSLint uses when reading tslint.json files, but
    // before parsing them.  In order for our base config to be
    // applied properly on a per-file basis, we must get TSLint to
    // parse it.
    this.baseConfig = tslint.Configuration.parseConfigFile(
      cfg.config, '.', tslint.Configuration.readConfigurationFile);

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
      debug(`File ${filePathAbs} doesn't live within root ${this.root}; `
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
        // TODO: This doesn't work when the root is '/'.  It omits the root
        // path from the search.
        configPath += path.sep + dirPart;
        const resolved = path.resolve(configPath);
        
        // Determine the config filename for the current dir.
        const configFile = tslint.Configuration.findConfigurationPath(
          // Specify undefined for the config filename to tell TSLint to
          // search for typical config files starting in the file's
          // directory and working back up the tree.
          undefined,
          resolved);
        
        if (configFile !== undefined)
        {
          // Load it.
          const loadedConfig =
            tslint.Configuration.loadConfigurationFromPath(configFile);

          // Merge it, giving ancestors less precedence as we go.
          mergedConfig = tslint.Configuration.extendConfigurationFile(
            mergedConfig, loadedConfig);
        }
      }
    }
    
    // Brunch lints one file at a time and tracks any failures per-file.  The
    // TSLint Linter object tracks all failures across all lint() calls.  As
    // such, we must clear the Linter's failures before each lint(), or we'll
    // attribute all previous failures to this lint() and end up with an
    // ever-growing list of failures.  This would confound Brunch's watcher
    // mechanism, making it unable to re-compile a failed compilation.
    this.linter.failures.length = 0;

    // Perform the linting.
    this.linter.lint(brunchFile.path, brunchFile.data, mergedConfig);
    const result = this.linter.getResult();

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
