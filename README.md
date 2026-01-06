# Playwright Script Generation MCP 服务

这是一个包装 playwright-mcp 并增加 Node.js 脚本生成功能的 MCP (Model Context Protocol) 服务。该服务不仅将请求转发到 playwright-mcp 服务执行浏览器自动化操作，还能记录操作步骤并生成对应的 Node.js 自动化测试脚本。

## 功能特性

### 1. MCP 协议兼容性
- 支持 MCP 协议的初始化请求
- 支持标准的 JSON-RPC 2.0 协议

### 2. Playwright 操作记录与脚本生成
- 记录所有执行的 Playwright 操作（点击、填写、等待、截图等）
- 生成完整的 Node.js 自动化测试脚本，通过 MCP 协议调用 Playwright 服务
- 脚本以 `test-时间戳.js` 格式保存
- 如果某个步骤失败，整个自动化测试会失败

### 3. 服务代理与转发
- 将非本地处理的请求转发到 playwright-mcp 服务
- 实现请求缓存机制，在服务未就绪时暂存请求
- 通过回调机制处理响应并返回给客户端

### 4. 服务健康检查
- 使用探针请求机制检测 playwright-mcp 服务状态
- 定期发送健康检查请求验证服务可用性
- 提供更准确的服务状态判断

### 5. 配置管理
- 集中管理服务参数、健康检查配置、日志配置等
- 支持配置化浏览器选择、超时时间等参数

## 支持的操作类型

- `click`: 点击元素
- `fill`: 填写表单
- `wait`: 等待指定时间
- `screenshot`: 截图
- `text`: 获取元素文本
- `get_elements`: 获取页面元素
- `snapshot`: 获取页面快照
- `navigate`: 导航到指定URL
- `press`: 按键操作
- `hover`: 悬停操作

## 新增功能

- `get_test_steps`: 获取当前记录的测试步骤
- `clear_test_steps`: 清空测试步骤
- `generate_test_script`: 生成完整的Node.js测试脚本

## 配置文件

服务使用 `config/service-config.js` 进行配置管理，包括：

- 服务名称和版本
- 浏览器选择（msedge, chrome, firefox, webkit）
- 健康检查间隔和方法
- 日志配置
- 脚本生成配置

## 模块结构

- `playwright-script-gen-mcp.js`: 主服务文件
- `modules/script-generator.js`: 脚本生成相关工具函数
- `modules/service-manager.js`: 服务管理功能
- `config/service-config.js`: 服务配置文件
- `start-service.js`: 服务启动脚本（带验证功能）

## 错误处理

- 参数验证：对传入的参数进行验证
- 服务可用性检查：检查 npx 和 playwright-mcp 是否可用
- 健康检查：定期检查 playwright-mcp 服务状态
- 请求队列：在服务未就绪时暂存请求
- 服务重启：在服务异常退出时自动重启

## 安装和运行

### 前置要求
1. 确保已安装 Node.js (版本 >= 14.0.0) 和 npm
2. 安装 playwright-mcp: `npm install -g @playwright/mcp@latest`

### 运行方式

#### 方式1：直接运行
```bash
node playwright-script-gen-mcp.js
```

#### 方式2：使用启动脚本（推荐）
```bash
node start-service.js
```
启动脚本会进行以下验证：
- 检查必要文件是否存在
- 验证 Node.js 版本
- 验证配置文件
- 检查 playwright-mcp 是否已安装

#### 方式3：使用 npm 脚本
```bash
npm start
```

## 日志

服务会将日志写入 `playwright-script-gen-mcp.log` 文件，包含时间戳和详细的操作信息。

## 使用浏览器本地数据

如果需要让Playwright使用浏览器的本地数据（如用户配置文件、缓存、登录信息等），可以在配置文件中设置以下参数：

```javascript
module.exports = {
  service: {
    // ... 其他配置 ...
    useUserDataDir: true,           // 启用本地数据目录
    userDataDir: 'C:\\Users\\YourUsername\\AppData\\Local\\Microsoft\\Edge\\User Data',  // 浏览器用户数据目录路径
    // ...
  }
};
```

启用此功能后，Playwright将使用指定的用户数据目录，这样可以保留浏览器的登录状态、书签、扩展等个性化设置。