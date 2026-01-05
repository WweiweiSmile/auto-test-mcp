// 生成 Python 脚本 - 处理标准MCP工具调用格式
import fs from "fs";
import path from "path";
import {connectToPlaywrightMcp} from "./playwright-script-gen-mcp";

const config = require("./config/service-config");
const {log, generatePythonScript} = require("./modules/script-generator");

const loadTestSteps = () => {
  let list = []
  if (fs.existsSync(testStepsFilePath)) {
    try {
      const data = fs.readFileSync(testStepsFilePath, 'utf8');
      list = JSON.parse(data);
      log(`从 ${testStepsFilePath} 加载了 ${testSteps.length} 个历史操作记录`);
    } catch (error) {
      log(`读取 testSteps 文件失败: ${error.message}`);
      list = [];
    }
  } else {
    list = [];
    log('testSteps 文件不存在，初始化为空数组');
  }

  return list
};


const testSteps = loadTestSteps()
 connectToPlaywrightMcp()
