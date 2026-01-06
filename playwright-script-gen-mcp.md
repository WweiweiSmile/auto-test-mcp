# Playwright Script Generation MCP 服务功能文档

## 概述

Playwright Script Generation MCP 是一个包装 Playwright MCP 服务并增加 Python 脚本生成功能的中间层服务。它作为代理层，将
Playwright MCP 的功能与 Python 脚本生成能力相结合，提供额外的工具和功能。

## 主要功能

### 1. Playwright MCP 服务代理

- 启动并管理 Playwright MCP 子进程 (`npx @playwright/mcp@latest`)
- 提供健康检查机制，确保服务可用性
- 将客户端请求转发到 Playwright MCP 并返回响应

### 2. 工具合并功能

- `tools/list` 方法响应中合并自定义工具
- 提供额外的 `playwright_script_generator` 工具

### 3. 请求队列管理

- 当 Playwright MCP 服务未就绪时，将请求添加到等待队列
- 服务就绪后自动处理队列中的请求

### 4. 健康检查机制

- 定期发送探针请求检查 Playwright MCP 服务状态
- 默认健康检查间隔从配置文件获取
- 服务异常时自动重启机制

### 5. 操作记录与脚本生成功能

- 记录通过 Playwright MCP
  执行的浏览器操作步骤到 `.testSteps` 文件
- 支持多种操作类型：click, fill, navigate, wait, screenshot, text, get_elements, snapshot, press, hover
- 通过 `extractActionFromMethod` 函数从 MCP 方法调用中提取操作信息
- 自动记录所有以 `browser/`, `page/`, `element/` 开头的操作到 `.testSteps` 文件，即使它们没有被显式支持
- 根据记录的操作步骤生成 Node.js 自动化测试脚本，通过 MCP 协议调用 Playwright 服务
- 脚本生成到指定目录，默认为 `./generated-scripts`
- 脚本生成成功后自动清除 `.testSteps` 文件中的历史记录
- 如果某个步骤失败，整个自动化测试会失败

## 工具定义

### playwright_script_generator 工具

该工具用于生成 Node.js 脚本，具体定义如下：

```javascript
{
  name: config.tools.playwright_script_generator.name,
  description: config.tools.playwright_script_generator.description,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "object",
        properties: {
          type: {
            type: "string"
          },      // 操作类型 (如: click, fill, navigate 等)
          selector: {
            type: "string"
          },  // 元素选择器
          value: {
            type: "string"
          }      // 操作值 (如: fill 操作的输入值)
        },
        required: ["type"]
      }
    }
  }
}
```

## 配置

服务使用 [config/service-config.js](file:///E:/Codes/agent/config/service-config.js) 中的配置：

- `config.service.browser`: 指定使用的浏览器类型 (msedge, chrome, firefox, webkit)
- `config.service.timeout`: 服务连接超时时间
- `config.healthCheck.interval`: 健康检查间隔
- `config.healthCheck.method`: 健康检查使用的方法
- `config.tools.playwright_script_generator`: 工具定义配置
- `config.scriptGeneration.outputDir`: 生成脚本的输出目录
- `config.scriptGeneration.headless`: 是否使用无头模式运行浏览器

## 服务流程

### 初始化流程

1. 启动 Playwright MCP 子进程 (使用 `npx` 或 `npx.cmd` 根据操作系统)
2. 发送初始健康检查请求
3. 等待服务响应确认就绪
4. 启动定期健康检查

### 请求处理流程

1. 接收客户端 MCP 请求
2. 检查 Playwright MCP 服务就绪状态
3. 如果服务未就绪，则将请求加入等待队列
4. 如果服务就绪，则将请求转发到 Playwright MCP
5. 处理来自 Playwright MCP 的响应
6. 对于 `tools/list` 方法，合并自定义工具
7. 对于 `playwright_script_generator` 方法，执行脚本生成逻辑
8. 对于其他浏览器操作方法（`browser/`, `page/`, `element/`
   开头），记录操作到 [testSteps](file:///E:/Codes/agent/modules/test-steps-manager.js#L11-L11) 数组并保存到 `.testSteps` 文件
9. 将响应返回给客户端

### Node.js 脚本生成流程

1. 服务初始化时创建 [TestStepsManager](file:///E:/Codes/agent/modules/test-steps-manager.js#L7-L79) 实例，用于管理测试步骤
2. 当接收到 MCP 方法请求时（如 `browser/navigate`, `page/click`, `page/fill`
   等），通过 [extractActionFromMethod](file:///E:/Codes/agent/playwright-script-gen-mcp.js#L21-L66)
   函数提取操作信息并添加到 [testSteps](file:///E:/Codes/agent/modules/test-steps-manager.js#L11-L11) 数组
3. 当接收到 `playwright_script_generator`
   工具请求时，使用 [generatePythonScript](file:///E:/Codes/agent/modules/script-generator.js#L146-L184) 函数生成包含所有记录步骤的
   Node.js 脚本，该脚本通过 MCP 协议调用 Playwright 服务
4. 生成包含所有记录步骤的 Node.js 脚本文件
5. 脚本文件保存到配置的输出目录中
6. 如果某个步骤失败，整个自动化测试会失败

### 支持的操作类型

- **click**: 点击元素，需要 `selector` 参数
- **fill**: 填充输入框，需要 `selector` 和 `value` 参数
- **navigate**: 导航到指定 URL，需要 `value` 参数
- **wait**: 等待指定时间（毫秒），需要 `value` 参数
- **screenshot**: 截图，需要 `value` 参数（保存路径）
- **text**: 获取元素文本，需要 `selector` 参数
- **get_elements**: 获取匹配的元素列表，需要 `selector` 参数
- **snapshot**: 获取页面内容快照
- **press**: 按键操作，需要 `selector` 和 `value` 参数
- **hover**: 悬停操作，需要 `selector` 参数

### 特殊响应处理

- **tools/list 方法**: 在响应的 `result.tools` 中合并工具
- **playwright_script_generator 方法**:
  处理脚本生成请求，验证操作参数，从 `.testSteps` 文件加载操作记录，生成
  Node.js 脚本并返回结果，生成后清除 `.testSteps` 文件中的历史记录
- **其他方法**: 直接返回 Playwright MCP 的原始响应，但会检查是否是浏览器操作（如 `browser/`, `page/`, `element/`
  开头的方法）并记录到 [testSteps](file:///E:/Codes/agent/modules/test-steps-manager.js#L11-L11) 数组并保存到 `.testSteps` 文件

## 错误处理

- 请求解析错误返回 JSON-RPC 标准错误 (-32700)
- 处理过程中的错误返回 (-32603) 服务器错误
- 服务连接失败时尝试重启
- 响应格式异常时进行容错处理
- 操作验证失败时返回具体错误信息
- 文件写入失败时记录错误日志

## 信号处理

服务监听 SIGINT 信号，在接收到信号时：

1. 停止健康检查定时器
2. 关闭 Playwright MCP 子进程
3. 正常退出

## 使用场景

1. **自动化测试**: 提供浏览器自动化功能
2. **脚本生成**: 根据操作生成 Node.js 自动化脚本，通过 MCP 协议调用 Playwright 服务
3. **工具聚合**: 将多种自动化工具统一到一个接口
4. **服务代理**: 为 Playwright MCP 提供额外的稳定性和功能扩展
5. **测试用例录制**: 记录操作步骤并生成可重复执行的测试脚本
6. **无代码/低代码测试**: 允许非技术用户通过简单操作生成自动化脚本

## 依赖

- Node.js 环境
- Playwright MCP (`@playwright/mcp` 包，全局安装)
- [modules/script-generator.js](file:///E:/Codes/agent/modules/script-generator.js) - 提供脚本生成和日志功能
- [modules/service-manager.js](file:///E:/Codes/agent/modules/service-manager.js) - 提供服务管理功能，包括跨平台的 npx 调用
- [modules/test-steps-manager.js](file:///E:/Codes/agent/modules/test-steps-manager.js) - 提供测试步骤管理功能
- [config/service-config.js](file:///E:/Codes/agent/config/service-config.js) - 服务配置