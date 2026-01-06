// service-manager.js - Playwright MCP 服务管理器
const { spawn } = require('child_process');
const { log } = require('./script-generator');
const config = require('./../auto_test.config.js');

class PlaywrightServiceManager {
  constructor(config) {
    this.config = config;
    this.isPlaywrightMcpReady = false;
    this.pendingRequests = []; // 存储等待服务启动的请求
    this.pendingCallbacks = new Map();
    this.healthCheckInterval = null;
    this.HEALTH_CHECK_INTERVAL = config.healthCheck.interval;
    this.mockPlaywrightMcpInstance = null;
  }

  // 连接到 playwright-mcp 服务
  connectToPlaywrightMcp() {
    log('尝试连接到 Playwright MCP 服务...');

    // 启动 playwright-mcp 子进程
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    this.mockPlaywrightMcpInstance = spawn(npxCmd, ['@playwright/mcp@latest', '--browser', this.config.service.browser], {
      stdio: ['pipe', 'pipe', 'pipe'], 
      shell: true
    });

    // 监听服务输出
    this.mockPlaywrightMcpInstance.stdout.on('data', (data) => {
      const output = data.toString();
      // 注意：不要将来自 playwright-mcp 的原始输出记录到 stdout，因为这会干扰 MCP 协议
      log(`Playwright MCP 输出: ${output}`);

      // 检查是否是健康检查的响应
      try {
        const response = JSON.parse(output);

        log(`Playwright MCP Response 输出: ${JSON.stringify(response)}    hase id:${response.id}`);

        if (response.id !== undefined && response.id !== null && String(response.id).startsWith('health_check_')) {
          log(`Playwright MCP Response  health_check_ 检查: `);
          // 这是健康检查的响应，说明服务已就绪
          if (!this.isPlaywrightMcpReady) {
            this.isPlaywrightMcpReady = true;
            log('Playwright MCP 服务通过健康检查已就绪');

            // 启动健康检查定时器
            if (this.healthCheckInterval) {
              clearInterval(this.healthCheckInterval);
            }
            this.healthCheckInterval = setInterval(() => this.performHealthCheck(), this.HEALTH_CHECK_INTERVAL);

            // 处理等待的请求
            this.processPendingRequests();
          }

          return;
        }

        if (response.id !== undefined && response.id !== null) {
          // 检查是否有对应的回调函数
          if (this.pendingCallbacks.has(response.id)) {
            const callback = this.pendingCallbacks.get(response.id);
            this.pendingCallbacks.delete(response.id); // 移除已处理的回调
            callback(null, response); // 调用回调函数处理响应
          } else {
            // 如果没有找到对应的回调，直接将响应写入到 stdout
            process.stdout.write(output + '\n');
          }
        }
      } catch (parseError) {
        // 如果解析失败，可能是非 JSON 数据或空行，直接输出到 stdout
        // 但要小心，这可能会干扰 MCP 协议
        log(`parseError ---->  ${parseError.toLocaleString()}`);
      }
    });

    // 监听错误
    this.mockPlaywrightMcpInstance.stderr.on('data', (data) => {
      log(`Playwright MCP 错误: ${data}`);
      // 注意：错误输出不应该发送到 stdout，因为它不是 MCP 协议的一部分
    });

    // 监听进程关闭
    this.mockPlaywrightMcpInstance.on('close', (code) => {
      log(`Playwright MCP 进程退出，代码 ${code}`);
      this.mockPlaywrightMcpInstance = null;
      this.isPlaywrightMcpReady = false;

      // 停止健康检查定时器
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // 如果不是预期关闭，尝试重启
      if (code !== 0) {
        log('尝试重启 Playwright MCP 服务...');
        setTimeout(() => {
          this.connectToPlaywrightMcp();
        }, 1000);
      }
    });

    // 监听进程错误
    this.mockPlaywrightMcpInstance.on('error', (err) => {
      log(`连接 Playwright MCP 时出错: ${err}`);
      this.mockPlaywrightMcpInstance = null;
      this.isPlaywrightMcpReady = false;

      // 停止健康检查定时器
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
    });

    // 发送初始健康检查请求
    setTimeout(() => {
      if (this.mockPlaywrightMcpInstance) {
        this.performHealthCheck();
      }
    }, 500); // 等待500毫秒后发送第一个健康检查请求
  }

  // 执行健康检查
  performHealthCheck() {
    // 检查是否有一个模拟的实例
    if (!this.mockPlaywrightMcpInstance) {
      // 如果没有实例，尝试连接或启动 playwright-mcp
      this.connectToPlaywrightMcp();
      return;
    }

    if (!this.mockPlaywrightMcpInstance.stdin) {
      // 如果实例的 stdin 不可用，停止健康检查
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      this.isPlaywrightMcpReady = false;
      return;
    }

    // 发送一个简单的探针请求来检查服务是否就绪
    const probeRequest = {
      method: this.config.healthCheck.method,  // 从配置文件获取健康检查方法
      id: `health_check_${Date.now()}`, 
      jsonrpc: '2.0'
    };

    try {
      log(`发送健康检查探针请求: ${JSON.stringify(probeRequest)}`);
      this.mockPlaywrightMcpInstance.stdin.write(JSON.stringify(probeRequest) + '\n');
    } catch (err) {
      log(`发送健康检查请求失败: ${err.message}`);
      this.isPlaywrightMcpReady = false;
    }
  }

  // 启动 Playwright MCP 服务
  startPlaywrightMcp() {
    return new Promise((resolve, reject) => {
      if (this.mockPlaywrightMcpInstance) {
        // 如果实例已存在，直接返回
        if (this.isPlaywrightMcpReady) {
          log('Playwright MCP 服务已存在且就绪');
          resolve(this.mockPlaywrightMcpInstance);
        } else {
          log('Playwright MCP 服务正在连接，等待就绪');
          // 等待服务准备好
          const checkReady = setInterval(() => {
            if (this.isPlaywrightMcpReady) {
              clearInterval(checkReady);
              resolve(this.mockPlaywrightMcpInstance);
            }
          }, 100);
        }
        return;
      }

      // 连接到 Playwright MCP 服务
      this.connectToPlaywrightMcp();

      // 等待服务准备好
      const checkReady = setInterval(() => {
        if (this.isPlaywrightMcpReady) {
          clearInterval(checkReady);
          resolve(this.mockPlaywrightMcpInstance);
        }
      }, 100);

      // 设置超时
      setTimeout(() => {
        clearInterval(checkReady);
        if (!this.isPlaywrightMcpReady) {
          reject(new Error('连接到 Playwright MCP 服务超时'));
        }
      }, this.config.service.timeout); // 使用配置文件中的超时时间
    });
  }

  // 处理等待的请求
  processPendingRequests() {
    log(`处理 ${this.pendingRequests.length} 个等待的请求`);
    while (this.pendingRequests.length > 0) {
      const {request, id, callback} = this.pendingRequests.shift();
      this.processPlaywrightRequest(request, id, callback);
    }
  }

  // 向 Playwright MCP 发送请求
  sendToPlaywrightMcp(request, id, callback) {
    // 使用健康检查机制判断服务是否就绪
    if (!this.mockPlaywrightMcpInstance || !this.isPlaywrightMcpReady) {
      log('Playwright MCP 服务未就绪，将请求添加到队列中');
      // 如果服务未准备好，将请求添加到队列中
      this.pendingRequests.push({request: request, id: id, callback: callback});
      return;
    }

    const mcpRequest = JSON.stringify(request) + '\n';

    try {
      log(`向 Playwright MCP 发送请求: ${JSON.stringify(request)}`);
      this.mockPlaywrightMcpInstance.stdin.write(mcpRequest);

      // 存储回调函数，用于处理响应
      if (callback) {
        this.pendingCallbacks.set(id, callback);
      }
    } catch (err) {
      log(`向 Playwright MCP 发送请求时出错: ${err}`);
      // 尝试重启服务
      this.mockPlaywrightMcpInstance = null;
      this.isPlaywrightMcpReady = false;

      // 停止健康检查定时器
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.startPlaywrightMcp().then(() => {
        // 重新发送请求
        this.sendToPlaywrightMcp(request, id, callback);
      });
    }
  }

  // 处理 Playwright 请求
  processPlaywrightRequest(request, id, callback) {
    // 使用健康检查机制判断服务是否就绪
    if (!this.isPlaywrightMcpReady) {
      log('Playwright MCP 服务未就绪，将请求添加到队列中');
      // 如果服务未准备好，将请求添加到队列中
      this.pendingRequests.push({request: request, id: id, callback: callback});
      return;
    }

    log(`处理 Playwright 请求: ${JSON.stringify(request)}`);
    this.sendToPlaywrightMcp(request, id, callback);
  }

  // 获取服务就绪状态
  getReadyStatus() {
    return this.isPlaywrightMcpReady;
  }

  // 获取MCP实例
  getMcpInstance() {
    return this.mockPlaywrightMcpInstance;
  }

  // 清理资源
  cleanup() {
    // 停止健康检查定时器
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // 关闭 playwright-mcp 实例
    if (this.mockPlaywrightMcpInstance) {
      this.mockPlaywrightMcpInstance.kill();
    }
  }
}

module.exports = { PlaywrightServiceManager }; // 移除未使用的spawn导出