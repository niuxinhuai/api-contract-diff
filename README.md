# api-contract-diff

[![CI](https://github.com/niuxinhuai/api-contract-diff/actions/workflows/ci.yml/badge.svg)](https://github.com/niuxinhuai/api-contract-diff/actions/workflows/ci.yml)

Compare OpenAPI, Swagger, GraphQL-ish JSON, or generic JSON contract files for breaking shape changes.

比较 OpenAPI、Swagger、类 GraphQL JSON 或通用 JSON 合同文件，识别破坏性结构变化。

## English

### Install

```bash
npm install -g api-contract-diff
```

For local development:

```bash
npm install
npm link
api-contract-diff --help
```

### Features

- Detects removed operations, removed responses, removed schemas, removed properties, type changes, and new required properties.
- Reads JSON and simple YAML OpenAPI files.
- Falls back to generic JSON/YAML shape diff for non-OpenAPI files.
- Separates breaking, additive, and warning-level changes.
- Supports ignored paths through `.api-contract-diff.json` or repeated `--ignore`.
- Can fail CI with `--fail-on-breaking`.

### Usage

```bash
api-contract-diff examples/openapi-old.json examples/openapi-new.json
api-contract-diff examples/openapi-old.yaml examples/openapi-new.json
api-contract-diff old.json new.json --json
api-contract-diff old.json new.json --fail-on-breaking
```

### Automation

Run this after generating API specs and before publishing client SDKs. Keep a committed previous spec or download the last release artifact.

### Test

```bash
npm test
npm --cache /tmp/npm-cache pack --dry-run .
```

## 中文

### 安装

```bash
npm install -g api-contract-diff
```

本地开发：

```bash
npm install
npm link
api-contract-diff --help
```

### 功能

- 识别删除接口、删除响应、删除 schema、删除属性、类型变化和新增必填字段。
- 支持 JSON 和简单 YAML OpenAPI 文件。
- 非 OpenAPI 文件会回退到通用 JSON/YAML 结构差异。
- 区分 breaking、additive 和 warning 级别变化。
- 支持通过 `.api-contract-diff.json` 或重复 `--ignore` 忽略路径。
- 可通过 `--fail-on-breaking` 用于 CI。

### 用法

```bash
api-contract-diff examples/openapi-old.json examples/openapi-new.json
api-contract-diff old.json new.json --json
api-contract-diff old.json new.json --fail-on-breaking
```

### 自动化

Run this after generating API specs and before publishing client SDKs.

### 测试

```bash
npm test
npm --cache /tmp/npm-cache pack --dry-run .
```
