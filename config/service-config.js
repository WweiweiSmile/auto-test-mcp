// service-config.js - 服务配置文件

module.exports = {
  // 服务配置
  service: {
    name: 'playwright-script-gen-mcp',
    version: '1.0.0',
    protocolVersion: '2025-11-25',
    browser: 'msedge', // 可选: msedge, chrome, firefox, webkit
    timeout: 30000, // 30秒超时
  },

  // 健康检查配置
  healthCheck: {
    interval: 5000, // 5秒检查一次
    method: 'ping', // 使用 ping 作为健康检查方法
    timeout: 10000, // 健康检查超时时间
  },

  // 日志配置
  logging: {
    enabled: true,
    logFile: 'E:\\Codes\\auto-test-mcp\\playwright-script-gen-mcp.log',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  },

  // 脚本生成配置
  scriptGeneration: {
    defaultFileName: 'test',
    outputDir: 'E:\\Codes\\auto-test-mcp\\generated-scripts',
    headless: false, // 默认非无头模式
  },

  // 工具配置
  tools: {
    playwright_script_generator: {
      name: 'playwright_script_generator',
      description: '根据记录的操作，生成playwright mcp的操作回放脚本',
    }
  }
};