// *********************************************************************
// Copyright 2018 Healthy Bytes Technology & Wellness
//
// Tests for plugin.js

'use strict';

const MockTslint = require('./MockTslint');

const fs = require('fs');
const path = require('path');
const tslint = require('tslint');

// Setup some paths and files for testing.  Some of the TSLint
// functions used during testing expect real directories and files
// to exist.  These files and directories are checked-in with the
// source code so they should already exist.
const dir1 = __dirname + path.sep + 'test_dir1';
const dir2 = dir1 +  path.sep + 'test_dir2';
// Linting tests use an imaginary source file, but building that
// file's linting config requires some actual tslint.json files in a
// directory hierarchy.
const tslintJson1 = dir1 + path.sep + 'tslint.json';
const tslintJson2 = dir2 + path.sep + 'tslint.json';

// A function that returns true if the given file exists; false
// otherwise.
function fileExists(filePath)
{
  try
  {
    return fs.accessSync(filePath) === undefined;
  }
  catch (error)
  {
    return false;
  }
}

// =======================================================================
// Test with our MockTslint.

describe('plugin', () =>
{
  // Load the plugin and tell it to use our MockTslint.
  process.env.TEST = true;
  const Plugin = require('../plugin');

  // ----------------------------------------------------------------------
  // Verify that our test directories and files exist.

  it('verify_test_dirs_and_files', () =>
  {
    expect(fileExists(dir1)).toEqual(true);
    expect(fileExists(dir2)).toEqual(true);
    expect(fileExists(tslintJson1)).toEqual(true);
    expect(fileExists(tslintJson2)).toEqual(true);
  });
  
  // ----------------------------------------------------------------------
  // Test class API.

  it('class_api', () =>
  {
    expect(Plugin.prototype.hasOwnProperty('brunchPlugin')).toEqual(true);
    expect(typeof Plugin.prototype.brunchPlugin).toEqual('boolean');
    expect(Plugin.prototype.brunchPlugin).toEqual(true);
    
    expect(Plugin.prototype.hasOwnProperty('type')).toEqual(true);
    expect(typeof Plugin.prototype.type).toEqual('string');
    expect(Plugin.prototype.type).toEqual('javascript');
  });
  
  // ----------------------------------------------------------------------
  // Test construction.

  describe('construction', () =>
  {
    // No Brunch config
    it('no_config', () =>
    {
      const plugin = new Plugin();
      expect(plugin.pattern).toEqual(/^app\/.*\.ts$/);
      expect(plugin.baseConfig).toEqual(
	{
	  extends: [],
	  jsRules: new Map(),
	  linterOptions: {},
	  rules: new Map(),
	  rulesDirectory: []
	});

      expect(plugin.linter instanceof MockTslint.Linter).toEqual(true);
      expect(plugin.linter.options).toEqual(
	{
	  fix: false,
	  quiet: false,
	  formatter: 'prose',
	  formattersDirectory: undefined,
	  rulesDirectory: undefined
	});
    });
    
    // Empty Brunch config
    it('empty_config', () =>
    {
      const plugin = new Plugin({});
      expect(plugin.pattern).toEqual(/^app\/.*\.ts$/);
      expect(plugin.baseConfig).toEqual(
	{
	  extends: [],
	  jsRules: new Map(),
	  linterOptions: {},
	  rules: new Map(),
	  rulesDirectory: []
	});

      expect(plugin.linter instanceof MockTslint.Linter).toEqual(true);
      expect(plugin.linter.options).toEqual(
	{
	  fix: false,
	  quiet: false,
	  formatter: 'prose',
	  formattersDirectory: undefined,
	  rulesDirectory: undefined
	});
    });

    // Brunch config has all expected fields and an extra one.  The
    // confg and options fields have some of their expected fields and
    // a few unknowns.
    it('some_with_extras', () =>
    {
      const cfg =
      {
	pattern: 'foo',
	unknownKey: 'ignored',
	config:
	{
	  extends: 'tslint:recommended',
	  unknownKey: 'ignored',
	  rulesDirectory: [dir1, dir2]
	},
	options:
	{
	  fix: true,
	  unknownKey: 'ignored',
	  formatter: 'Shakespeare',
	}
      };

      const plugin = new Plugin({plugins: {tslint: cfg}});
      expect(plugin.pattern).toEqual('foo');
      expect(plugin.baseConfig).toEqual(
	{
	  extends: ['tslint:recommended'],
	  jsRules: new Map(),
	  linterOptions: {},
	  rules: new Map(),
	  rulesDirectory: [dir1, dir2]
	});

      expect(plugin.linter instanceof MockTslint.Linter).toEqual(true);
      expect(plugin.linter.options).toEqual(
	{
	  fix: true,
	  quiet: false,
	  formatter: 'Shakespeare',
	  formattersDirectory: undefined,
	  rulesDirectory: undefined
	});
    });

    // Brunch config and all fields have all their expected fields.
    it('all_fields', () =>
    {
      const cfg =
      {
	pattern: 'foo',
	config:
	{
	  extends: ['tslint:recommended', 'tslint:latest'],
	  jsRules: {rule1: 'rule', rule2: 'rule'},
	  linterOptions: {foo: 'bar'},
	  rules: {rule1: 'rule', rule2: 'rule'},
	  rulesDirectory: [dir1, dir2]
	},
	options:
	{
	  fix: true,
	  quiet: true,
	  formatter: 'Shakespeare',
	  formattersDirectory: [dir2, dir1],
	  rulesDirectory: dir2
	}
      };

      const plugin = new Plugin({plugins: {tslint: cfg}});
      expect(plugin.pattern).toEqual('foo');
      expect(plugin.baseConfig).toEqual(
	{
	  extends: ['tslint:recommended', 'tslint:latest'],
	  jsRules: new Map(
	    [
	      ['rule1', {ruleArguments: undefined, ruleSeverity: 'error'}],
	      ['rule2', {ruleArguments: undefined, ruleSeverity: 'error'}]
	    ]),
	  linterOptions: {},
	  rules: new Map(
	    [
	      ['rule1', {ruleArguments: undefined, ruleSeverity: 'error'}],
	      ['rule2', {ruleArguments: undefined, ruleSeverity: 'error'}]
	    ]),
	  rulesDirectory: [dir1, dir2]
	});

      expect(plugin.linter instanceof MockTslint.Linter).toEqual(true);
      expect(plugin.linter.options).toEqual(
	{
	  fix: true,
	  quiet: true,
	  formatter: 'Shakespeare',
	  formattersDirectory: [dir2, dir1],
	  rulesDirectory: dir2
	});
    });
  });
  
  // ----------------------------------------------------------------------
  // Test lint().

  describe('lint', () =>
  {
    // Create our Plugin before each test.
    let plugin;

    beforeEach(() =>
    {
      const cfg =
      {
        root: '../',
	config:
	{
	  rules:
          {
            'no-console': false
          }
	},
	options:
	{
	  quiet: true
	}
      };

      plugin = new Plugin({plugins: {tslint: cfg}});
    });

    // Empty file data, and unknown path without any tslint.json present.
    it('empty_data_unknown_path_no_tslint_json', async () =>
    {
      // A file that doesn't exist, and has no tslint.json in its ancestry.
      const file = path.sep + 'tslint-brunch-not-a-file';
      expect(fileExists(file)).toEqual(false);
      
      // Set the lint result to indicate no errors, and lint.
      plugin.linter.setResult(0, '');
      const result = await plugin.lint({data: '', path: file});

      expect(result).toEqual(true);
      expect(plugin.linter.filePath).toEqual(file);
      expect(plugin.linter.fileContent).toEqual('');
      expect(plugin.linter.lintConfig).toEqual(
	{
          defaultSeverity: undefined,
	  extends: [],
	  jsRules: new Map(),
	  rules: new Map(
	    [
	      ['no-console', {ruleArguments: [], ruleSeverity: 'off'}]
	    ]),
	  rulesDirectory: []
        });
      
      // Set the lint result to indicate some errors, and lint again.
      plugin.linter.setResult(83, 'Full of problems!');
      try
      {
        await plugin.lint({data: '', path: file});
        fail('lint succeeded unexpectedly');
      }
      catch (error)
      {
        expect(error).toEqual('Full of problems!');
      }

      return Promise.resolve();
    });

    // Non-empty file data, and a real path that contains tslint.json
    // files.
    it('data_known_path_with_tslint_json', async () =>
    {
      const file = dir2 + path.sep + 'file.js';
      
      // Set the lint result to indicate no errors, and lint.
      plugin.linter.setResult(0, '');
      const result = await plugin.lint(
        {
          data: 'const foo = false;',
          path: file
        });

      expect(result).toEqual(true);
      expect(plugin.linter.filePath).toEqual(file);
      expect(plugin.linter.fileContent).toEqual('const foo = false;');
      expect(plugin.linter.lintConfig).toEqual(
	{
	  extends: [],
	  jsRules: new Map(),
	  linterOptions: {},
	  rules: new Map(
	    [
              // We expect the base config's rule for 'no-console' to
              // be overridden by that in tslintJson1, and then again
              // in tslintJson2.
	      ['no-console', {ruleArguments: ['warn'], ruleSeverity: 'error'}],
              // tslintJson2 specifies the 'ban' rule.
              ['ban', {ruleArguments: ['eval'], ruleSeverity: 'error'}]
	    ]),
	  rulesDirectory: []
        });

      return Promise.resolve();
    });
  });
});

// =======================================================================
// Test with the real TSLint.

describe('real_tslint', () =>
{
  // Load the plugin and let it use the real TSLint.
  delete process.env.TEST;
  // GOTCHA: The code in describe() blocks runs even when no tests
  // within those blocks will execute, so the plugin has already been
  // loaded and cached in TEST mode above.  We just explictly delete
  // the plugin from the cache in order for it to be loaded again.
  delete require.cache[require.resolve('../plugin')];
  // Load our plugin module again.
  const Plugin = require('../plugin');

  // Non-empty file data, and a real path that contains tslint.json
  // files.
  it('data_known_path_with_tslint_json', async () =>
  {
    const cfg =
    {
      root: __dirname,
      config:
      {
        rules:
        {
          'no-console': false
        }
      },
      options:
      {
        quiet: true
      }
    };

    const plugin = new Plugin({plugins: {tslint: cfg}});

    // Setup file data that will fail the rules found in the test
    // tslint.json files.
    const data =
      "console.error('This is allowed');"
      + "console.warn('This is not allowed');"
      + "eval('This is not allowed');";

    // GOTCHA: We can't actually specify a real file here or TSLint
    // will read its contents even though we're supplying the
    // content we want linted.  So we specify a non-existent file
    // which apparently forces TSLint to use the given content.
    const file = dir2 + '/not-a-file';
    expect(fileExists(file)).toEqual(false);

    try
    {
      await plugin.lint({data: data, path: file});
      fail('lint succeeded unexpectedly');
    }
    catch (error)
    {
      expect(error).toEqual(
        `\nERROR: ${file}[1, 34]: Calls to 'console.warn' are not allowed.\n`
        + `ERROR: ${file}[1, 70]: Calls to 'eval' are not allowed.\n`);
    }

    return Promise.resolve();
  });
});

// *********************************************************************
