// 生成 Python 脚本 - 处理标准MCP工具调用格式
import fs from "fs";
import path from "path";

const config = require("./config/service-config");
const {log, generatePythonScript} = require("./modules/script-generator");

let currentPageUrl = '';
const testStepsFilePath = path.join(__dirname, 'testSteps.txt');

function loadTestSteps() {
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
}

const outputDir = config.scriptGeneration.outputDir;
const fileName = `${outputDir}/${config.scriptGeneration.defaultFileName}-${Date.now()}.py`;

log(`playwright_script_generator  testSteps---> ${JSON.stringify(testSteps)}`)

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, {recursive: true});
}

const generationResult = generatePythonScript('', loadTestSteps(), fileName);

console.log('generationResult------>',generationResult)