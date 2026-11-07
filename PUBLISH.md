# 发布到 GitHub

当前发布包位于 `release/`：

- `墨印-0.9.7-安装版.exe`
- `墨印-0.9.7-便携版.exe`
- `墨印-0.9.7-源码.zip`

## 第一次发布

本机需要 Git 和 GitHub CLI：

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
gh auth login
```

然后在项目目录执行（把 `UserWZ08/MoYin` 换成你的账号/仓库名）：

```powershell
cd D:\DEEPSEEK\Print\cloud-print-assistant

git init -b main
git add .
git commit -m "墨印 MoPrint 0.9.7"
gh repo create UserWZ08/MoYin --public --source=. --remote=origin --push

gh release create v0.9.7 `
  "release/墨印-0.9.7-安装版.exe" `
  "release/墨印-0.9.7-便携版.exe" `
  "release/墨印-0.9.7-源码.zip" `
  --title "墨印 MoPrint 0.9.7" `
  --notes-file CHANGELOG.md
```

## 后续发布

```powershell
git add .
git commit -m "描述本次改动"
git push
gh release create v0.9.8 release/*.exe --title "墨印 0.9.8" --notes-file CHANGELOG.md
```

## 注意

- 不要提交 `node_modules/`、`dist/`、`release/`、生成的 C# `.exe`；`.gitignore` 已处理。
- 安装包未做代码签名，Windows SmartScreen 可能提示；发布页应明确说明。
- GitHub 仓库描述建议：`墨印 MoPrint - 免费开源的本地打印工作台（AGPLv3）`。
- 源码包已包含 `.github` Issue 模板、PR 模板、Actions、AGPLv3、构建说明和示例文件。
