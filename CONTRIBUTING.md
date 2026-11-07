# 贡献指南

感谢你愿意帮助墨印。

## 开发环境

- Windows 10/11 x64
- Node.js 20+
- npm 10+
- .NET Framework 4.x（Windows 自带，用于编译 `build/*.cs` 辅助程序）

```powershell
npm install
npm run dev        # Vite 前端 + Electron
npm run build      # 构建前端
node tools/build-prefs.js  # 编译 C# 首选项/能力/打印辅助程序
npm run dist       # 生成安装版和便携版
```

## 提交前

1. 运行 `npm run build`，确认没有构建错误。
2. 运行 `node tools/build-prefs.js`，确认三个 C# 辅助程序都能编译。
3. 手动检查：
   - A4/A3 打印是否真实生效
   - 黑白/彩色打印机能力校验
   - 打印首选项能打开
   - 快捷键和拖拽没有回归
4. 更新 `CHANGELOG.md`。

## 代码约定

- 前端使用 React 函数组件和 hooks。
- 不提交 `node_modules`、`dist`、`release`、生成的 `.exe`。
- 不把用户文件、真实客户信息、打印机序列号写进仓库。
- 新增功能必须有实际实现，不要保留“看起来可点但不起作用”的开关。
- 保持 AGPLv3 兼容：新增依赖必须允许 AGPLv3 分发。

## 许可证

提交代码即表示你同意以 **AGPL-3.0-or-later** 授权你的贡献。
