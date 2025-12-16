import * as assert from 'assert';
import * as vscode from 'vscode';
import { TypeScriptAdapter } from '../../src/adapters/TypeScriptAdapter';
import { PythonAdapter } from '../../src/adapters/PythonAdapter';
import { JavaAdapter } from '../../src/adapters/JavaAdapter';
import { GoAdapter } from '../../src/adapters/GoAdapter';
import { RustAdapter } from '../../src/adapters/RustAdapter';
import { CppAdapter } from '../../src/adapters/CppAdapter';

suite('Language Adapter Tests', () => {
	suite('TypeScriptAdapter', () => {
		const adapter = new TypeScriptAdapter();

		test('Should handle TypeScript and JavaScript', () => {
			assert.ok(adapter.canHandle('typescript'));
			assert.ok(adapter.canHandle('javascript'));
			assert.ok(adapter.canHandle('typescriptreact'));
			assert.ok(adapter.canHandle('javascriptreact'));
			assert.ok(!adapter.canHandle('python'));
		});

		test('Should detect import statements', () => {
			assert.ok(adapter.isImportStatement("import React from 'react';"));
			assert.ok(adapter.isImportStatement("import { useState } from 'react';"));
			assert.ok(adapter.isImportStatement("const fs = require('fs');"));
			assert.ok(!adapter.isImportStatement("const x = 5;"));
		});

		test('Should parse named imports', () => {
			const result = adapter.parseImport("import { useState, useEffect } from 'react';", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'named');
			assert.deepStrictEqual(result.symbols, ['useState', 'useEffect']);
			assert.strictEqual(result.module, 'react');
		});

		test('Should parse default imports', () => {
			const result = adapter.parseImport("import React from 'react';", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['React']);
			assert.strictEqual(result.module, 'react');
		});

		test('Should detect side-effect imports', () => {
			const result = adapter.parseImport("import './styles.css';", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'side-effect');
			assert.strictEqual(result.module, './styles.css');
		});

		test('Should detect side effects in CSS imports', () => {
			const importInfo = {
				type: 'side-effect' as const,
				symbols: [],
				module: './styles.css',
				fullText: "import './styles.css';",
				range: new vscode.Range(0, 0, 0, 25)
			};
			assert.ok(adapter.hasSideEffects(importInfo));
		});
	});

	suite('PythonAdapter', () => {
		const adapter = new PythonAdapter();

		test('Should handle Python', () => {
			assert.ok(adapter.canHandle('python'));
			assert.ok(!adapter.canHandle('typescript'));
		});

		test('Should detect import statements', () => {
			assert.ok(adapter.isImportStatement("import os"));
			assert.ok(adapter.isImportStatement("from os import path"));
			assert.ok(!adapter.isImportStatement("x = 5"));
		});

		test('Should parse from imports', () => {
			const result = adapter.parseImport("from os import path, getcwd", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'named');
			assert.deepStrictEqual(result.symbols, ['path', 'getcwd']);
			assert.strictEqual(result.module, 'os');
		});

		test('Should parse regular imports', () => {
			const result = adapter.parseImport("import os", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['os']);
		});

		test('Should detect __future__ side effects', () => {
			const importInfo = {
				type: 'named' as const,
				symbols: ['annotations'],
				module: '__future__',
				fullText: "from __future__ import annotations",
				range: new vscode.Range(0, 0, 0, 35)
			};
			assert.ok(adapter.hasSideEffects(importInfo));
		});
	});

	suite('JavaAdapter', () => {
		const adapter = new JavaAdapter();

		test('Should handle Java', () => {
			assert.ok(adapter.canHandle('java'));
			assert.ok(!adapter.canHandle('typescript'));
		});

		test('Should detect import statements', () => {
			assert.ok(adapter.isImportStatement("import java.util.List;"));
			assert.ok(adapter.isImportStatement("import static java.lang.Math.PI;"));
			assert.ok(!adapter.isImportStatement("public class Foo {}"));
		});

		test('Should parse regular imports', () => {
			const result = adapter.parseImport("import java.util.ArrayList;", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['ArrayList']);
			assert.strictEqual(result.module, 'java.util.ArrayList');
		});

		test('Should parse static imports', () => {
			const result = adapter.parseImport("import static java.lang.Math.PI;", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'named');
			assert.deepStrictEqual(result.symbols, ['PI']);
		});

		test('Should parse star imports', () => {
			const result = adapter.parseImport("import java.util.*;", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'namespace');
			assert.deepStrictEqual(result.symbols, ['*']);
		});
	});

	suite('GoAdapter', () => {
		const adapter = new GoAdapter();

		test('Should handle Go', () => {
			assert.ok(adapter.canHandle('go'));
			assert.ok(!adapter.canHandle('typescript'));
		});

		test('Should detect import statements', () => {
			assert.ok(adapter.isImportStatement('import "fmt"'));
			assert.ok(adapter.isImportStatement("import ("));
			assert.ok(!adapter.isImportStatement("func main() {}"));
		});

		test('Should parse regular imports', () => {
			const result = adapter.parseImport('import "fmt"', 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['fmt']);
			assert.strictEqual(result.module, 'fmt');
		});

		test('Should parse blank imports', () => {
			const result = adapter.parseImport('import _ "database/sql/driver"', 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'side-effect');
			assert.strictEqual(result.module, 'database/sql/driver');
		});
	});

	suite('RustAdapter', () => {
		const adapter = new RustAdapter();

		test('Should handle Rust', () => {
			assert.ok(adapter.canHandle('rust'));
			assert.ok(!adapter.canHandle('typescript'));
		});

		test('Should detect use statements', () => {
			assert.ok(adapter.isImportStatement("use std::collections::HashMap;"));
			assert.ok(adapter.isImportStatement("pub use std::io;"));
			assert.ok(!adapter.isImportStatement("fn main() {}"));
		});

		test('Should parse simple use statements', () => {
			const result = adapter.parseImport("use std::io;", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['io']);
			assert.strictEqual(result.module, 'std::io');
		});

		test('Should parse glob imports', () => {
			const result = adapter.parseImport("use std::prelude::*;", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'namespace');
			assert.deepStrictEqual(result.symbols, ['*']);
		});

		test('Should detect prelude side effects', () => {
			const importInfo = {
				type: 'namespace' as const,
				symbols: ['*'],
				module: 'std::prelude',
				fullText: "use std::prelude::*;",
				range: new vscode.Range(0, 0, 0, 20)
			};
			assert.ok(adapter.hasSideEffects(importInfo));
		});
	});

	suite('CppAdapter', () => {
		const adapter = new CppAdapter();

		test('Should handle C and C++', () => {
			assert.ok(adapter.canHandle('c'));
			assert.ok(adapter.canHandle('cpp'));
			assert.ok(adapter.canHandle('cuda-cpp'));
			assert.ok(!adapter.canHandle('java'));
		});

		test('Should detect include statements', () => {
			assert.ok(adapter.isImportStatement("#include <iostream>"));
			assert.ok(adapter.isImportStatement('#include "myheader.h"'));
			assert.ok(adapter.isImportStatement("  #  include  <vector>"));
			assert.ok(!adapter.isImportStatement("int main() {}"));
		});

		test('Should parse system header includes', () => {
			const result = adapter.parseImport("#include <iostream>", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['iostream']);
			assert.strictEqual(result.module, 'iostream');
		});

		test('Should parse local header includes', () => {
			const result = adapter.parseImport('#include "myheader.h"', 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'side-effect');
			assert.deepStrictEqual(result.symbols, ['myheader']);
			assert.strictEqual(result.module, 'myheader.h');
		});

		test('Should parse path-based includes', () => {
			const result = adapter.parseImport("#include <boost/algorithm/string.hpp>", 0);
			assert.ok(result);
			assert.strictEqual(result.type, 'default');
			assert.deepStrictEqual(result.symbols, ['string']);
			assert.strictEqual(result.module, 'boost/algorithm/string.hpp');
		});

		test('Should detect side effects in local headers', () => {
			const importInfo = {
				type: 'side-effect' as const,
				symbols: ['config'],
				module: 'config.h',
				fullText: '#include "config.h"',
				range: new vscode.Range(0, 0, 0, 20)
			};
			assert.ok(adapter.hasSideEffects(importInfo));
		});

		test('Should detect side effects in iostream', () => {
			const importInfo = {
				type: 'default' as const,
				symbols: ['iostream'],
				module: 'iostream',
				fullText: '#include <iostream>',
				range: new vscode.Range(0, 0, 0, 19)
			};
			assert.ok(adapter.hasSideEffects(importInfo));
		});

		test('Should detect side effects in test headers', () => {
			const importInfo = {
				type: 'default' as const,
				symbols: ['gtest'],
				module: 'gtest/gtest.h',
				fullText: '#include <gtest/gtest.h>',
				range: new vscode.Range(0, 0, 0, 24)
			};
			assert.ok(adapter.hasSideEffects(importInfo));
		});

		test('Should not detect side effects in pure utility headers', () => {
			const importInfo = {
				type: 'default' as const,
				symbols: ['vector'],
				module: 'vector',
				fullText: '#include <vector>',
				range: new vscode.Range(0, 0, 0, 17)
			};
			assert.ok(!adapter.hasSideEffects(importInfo));
		});
	});
});
