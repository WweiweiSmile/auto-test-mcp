// test-steps-manager.js - 管理测试步骤的模块

const fs = require('fs');
const {log} = require('./script-generator');
const config = require('./../auto_test.config.js');

// 定义testSteps文件路径
const testStepsFilePath = config.filePaths.testSteps;

class TestStepsManager {
  constructor() {
    this.testSteps = this.loadTestSteps();
    this.currentPageUrl = '';
  }

  // 从testSteps文件中加载历史操作记录
  loadTestSteps() {
    let list;
    if (fs.existsSync(testStepsFilePath)) {
      try {
        const data = fs.readFileSync(testStepsFilePath, 'utf8');
        list = JSON.parse(data);
        log(`从 ${testStepsFilePath} 加载了 ${list.length} 个历史操作记录`);
      } catch (error) {
        log(`读取 testSteps 文件失败: ${error.message}`);
        list = [];
      }
    } else {
      list = [];
      log('testSteps 文件不存在，初始化为空数组');
    }

    return list;
  }

  // 保存测试步骤到testSteps文件
  saveTestSteps() {
    try {
      fs.writeFileSync(testStepsFilePath, JSON.stringify(this.testSteps, null, 2), 'utf8');
      log(`测试步骤已保存到 ${testStepsFilePath}`);
    } catch (error) {
      log(`保存 testSteps 文件失败: ${error.message}`);
    }
  }

  // 清除testSteps文件中的历史记录
  clearTestSteps() {
    this.testSteps = [];
    try {
      if (fs.existsSync(testStepsFilePath)) {
        fs.writeFileSync(testStepsFilePath, '[]', 'utf8');
        log(`已清除 ${testStepsFilePath} 中的历史记录`);
      }
    } catch (error) {
      log(`清除 testSteps 文件失败: ${error.message}`);
    }
  }

  // 获取当前测试步骤
  getTestSteps() {
    return this.testSteps;
  }

  // 添加测试步骤
  addTestStep(step) {
    this.testSteps.push(step);
    log(`记录操作到testSteps: ${JSON.stringify(step)}`);
    this.saveTestSteps();
  }

  // 设置当前页面URL
  setCurrentPageUrl(url) {
    this.currentPageUrl = url;
  }

  // 获取当前页面URL
  getCurrentPageUrl() {
    return this.currentPageUrl;
  }
}

module.exports = TestStepsManager;