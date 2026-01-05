# Playwright Script Generation MCP 服务使用说明

## 概述

Playwright Script Generation MCP 是一个包装 Playwright MCP 服务并增加 Node.js 脚本生成功能的中间层服务。它作为代理层，将 Playwright MCP 的功能与 Node.js 脚本生成能力相结合，提供额外的工具和功能。

## 安装要求

1. 安装 Node.js (v16 或更高版本)
2. 全局安装 Playwright MCP:
   ```bash
   npm install -g @playwright/mcp@latest
   ```

## 启动服务

```bash
node playwright-script-gen-mcp.js
```

## 功能特性

### 1. 工具合并
- 服务启动后，会在 `initialize` 和 `tools/list` 方法的响应中合并自定义的 `playwright_script_generator` 工具
- 可以通过 MCP 协议访问所有 Playwright MCP 工具和自定义工具

### 2. 操作记录
- 服务会自动记录所有浏览器操作（如 `browser_navigate`, `browser_click`, `browser_fill` 等）
- 操作信息会被存储在内部的 `testSteps` 数组中

### 3. Node.js 脚本生成
- 使用 `playwright_script_generator` 工具可以生成包含记录操作的 Node.js 脚本
- 生成的脚本通过 MCP 协议调用 Playwright 服务，而不是直接使用 Playwright API
- 如果某个步骤失败，整个自动化测试会失败
- 生成的脚本保存在 `./generated-scripts` 目录中
- 脚本使用 Node.js 实现自动化操作

## 配置

服务使用 `config/service-config.js` 进行配置，包括：

- `service.browser`: 指定使用的浏览器类型 (msedge, chrome, firefox, webkit)
- `scriptGeneration.outputDir`: 生成脚本的输出目录
- `scriptGeneration.headless`: 是否使用无头模式运行浏览器

## 使用示例

### 1. 初始化服务
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {},
  "id": "init-1"
}
```

### 2. 执行浏览器操作
```json
{
  "jsonrpc": "2.0",
  "method": "browser_navigate",
  "params": {
    "url": "https://example.com"
  },
  "id": "nav-1"
}
```

```json
{
  "jsonrpc": "2.0",
  "method": "browser_click",
  "params": {
    "element": "submit button",
    "ref": "button#submit"
  },
  "id": "click-1"
}
```

### 3. 生成测试脚本
使用 `playwright_script_generator` 工具生成 Node.js 脚本：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "playwright_script_generator",
    "arguments": {}
  },
  "id": "gen-script-1"
}
```

## 生成的脚本包含

生成的脚本包含:
- 使用 Node.js 的自动化代码
- 按执行顺序排列的操作步骤
- 通过 MCP 协议与 Playwright 服务通信的逻辑
- 与记录操作对应的页面交互代码
- 错误处理和资源清理逻辑
- 如果某个步骤失败，整个自动化测试会失败