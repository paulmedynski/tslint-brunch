// *********************************************************************
// Copyright 2018 Healthy Bytes Technology & Wellness
//
// A mock TSLint class for testing.

'use strict';

const tslint = require('tslint');

class MockTslint
{
  constructor(options)
  {
    this.options = options;

    this.filePath = undefined;
    this.fileContent = undefined;
    this.lintConfig = undefined;
    this.result = undefined;
  }

  lint(filePath, fileContent, lintConfig)
  {
    this.filePath = filePath;
    this.fileContent = fileContent;
    this.lintConfig = lintConfig;
  }

  getResult()
  {
    return this.result;
  }

  setResult(errorCount, output)
  {
    this.result = { errorCount: errorCount, output: output };
  }
  
  reset()
  {
    this.filePath = undefined;
    this.fileContent = undefined;
    this.lintConfig = undefined;
  }
}

// TSLint exposes its constructor as Linter.
exports.Linter = MockTslint;

// Make TSLint's Configuration object available.
exports.Configuration = tslint.Configuration;

//*********************************************************************
