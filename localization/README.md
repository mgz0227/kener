# 保留中文汉化

`zh-CN.patch` 保存相对上游的 `src/` 和组件测试配置 `vite.config.ts` 改动；`zh-CN.json` 记录对应的上游提交。命令在仓库根目录执行。

同步上游后保留汉化：

```sh
git fetch upstream
git merge upstream/main
# 如有冲突，保留中文文本和上游功能，再提交合并结果
node scripts/localization.mjs export upstream/main
git add localization/zh-CN.patch localization/zh-CN.json
git commit -m "更新汉化补丁"
```

在未汉化的完整 Git 仓库中应用补丁：

```sh
node scripts/localization.mjs apply
# 或指定补丁文件
node scripts/localization.mjs apply /path/to/zh-CN.patch
```

先提交或用 `git stash` 保存已有修改。脚本优先普通应用，再尝试 Git 三方合并；缺少历史对象时需要先获取对应上游历史。冲突时退出，工作区和索引保持原样。应用后检查并提交改动；重复应用不会修改文件。

导出只读取已提交的源码和组件测试配置差异，不包含依赖声明、站点配置或构建产物。先检查差异确实属于汉化；补丁不会自动翻译上游新增页面。应用后运行 `npm run check` 和 `npm test`，并检查上游新增的后台页面。

验证脚本：`node --test scripts/localization.test.mjs`。
