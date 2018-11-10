# tslint-brunch
A TSLint plugin for Brunch

## Configuration
Add a `tslint` object to your Brunch config's `plugins` object:
```
{
  plugins:
  {
    tslint:
    {
      <options here>
    }
  }
}
```

All options are optional.  The following options are supported:

* `pattern` (`RegExp`):
  * A regex that matches all TypeScript files that should be  
    processed by the linter.  Defaults to: `/^app/.*\.ts$/`.
* `root` (`string`):
  * The path at which to stop looking further back in the directory  
    ancestry for TSLint config files when linting.  This is analogous  
    to ESLint's `root` field in its config options.  This would  
    typically be set to the root of your project.  Defaults to `'/'`.
* `config` (`object`):
  * Any options that may be found in tslint.json, in JavaScript  
    notation rather than JSON notation.  These are used as the base  
    config for all linting operations.  
    See the [TSLint documentation](https://palantir.github.io/tslint/usage/configuration/)  
    for further information.  Defaults to `{}`.
* `fix` (`boolean`):
  * True to attempt to fix problems for rules that support fixing;  
    false to only report on problems.  Defaults to `false`.
* `quiet` (`boolean`):
  * True to only report on errors; false to report on all problems.  
    Defaults to `false`.
* `formatter` (`string` or `FormatterConstructor` function):
  * The format in which problems are reported.  There are  
    several builtin formatters that may be specified by string.  
    If you wish to specify your own formatter, put it in a file  
    in the specified formattersDirectory, or provide a  
    TSLint `FormatterConstructor` function.  Defaults to `'prose'`.
* `formattersDirectory` (`string`):
  * The directory in which to find the formatter definitions.  
    If you specify a custom formatter whose definition doesn't  
    reside in the builtin formatters directory, you must  
    specify this to locate your customer formatter.  The  
    builtin formatters are always considered first, and then  
    this drectory will be considered.  Defaults to `undefined`.
* `rulesDirectory` (`string` or `string[]`):
  * One or more directories containing custom rules.  The  
    builtin rules are always considered first, then rules in  
    these directories in the order provided.  Defaults to  
    `undefined`.

Sample config:
```
{
  plugins:
  {
    tslint:
    {
      pattern: 'myfile.ts',
      root: '/path/to/project',
      config:
      {
        extends: 'tslint:recommended',
        rules:
        {
          'no-console': false
        }
      },
      fix: false,
      quiet: true,
      formatter: 'verbose',
      formattersDirectory: '/path/to/formatters',
      rulesDirectory: ['/path/to/rules', '/more/rules/here']
    }
  }
}
```
