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

### Usage

Compare two JSON contract files.

```bash
api-contract-diff old-openapi.json new-openapi.json
api-contract-diff old.json new.json --json
```

### Status

This is an MVP designed to be useful immediately and easy to extend. It has no runtime dependencies and targets Node.js 18+.

### Test

```bash
npm test
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

### 用法

比较两个 JSON 合同文件。

```bash
api-contract-diff old-openapi.json new-openapi.json
api-contract-diff old.json new.json --json
```

### 当前状态

这是一个可以直接使用的 MVP，重点是小、清晰、容易二次开发。运行时无第三方依赖，要求 Node.js 18+。

### 测试

```bash
npm test
```
