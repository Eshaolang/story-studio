# Story Studio

## 当前版本：静态阅读分享

只读分享及导出已替代下方历史版本的在线协作功能。当前 GitHub Pages 界面不需要账号、数据库或共享服务器，不提供评论或共同编辑。

- 在故事中点击“分享只读链接”，复制完整链接发给朋友。链接携带压缩后的故事快照，不会把正文提交到代码仓库。内容不加密，持有完整链接的人能读取；发出后无法撤销。后续修改需重新生成链接。
- 图片较多时链接可能过长。此时点击“导出只读网页”，将 HTML 文件发给朋友，用浏览器打开即可离线阅读，图片包含在文件中。
- “导出图片”和“导出 PDF”保留。“备份故事”生成可重新导入编辑的 JSON 文件。
- 静态快照没有实时同步、留言或访问身份验证。

以下在线协作说明仅供历史实现参考，不适用于当前静态分享界面。

故事编写工具：旁白、对白、角色头像、插图、阅读预览，以及本地自动保存。

## 本次补齐

- **导出图片**：导出标题和全部正文，包括头像、对白组和插图；长篇自动分成多张 PNG，逐张下载，不受编辑页分页影响。
- **导出 PDF**：打开排版后的打印窗口，在打印目标中选择“另存为 PDF”。保留真实换行。
- **故事备份与导入**：`.story.json` 包含完整角色、图片与正文，可恢复编辑；文本导出仍可使用。
- **邀请共享**：开启共享后产生编辑和只读两种链接。约每 4 秒同步一次，也可立即同步。作者可更换邀请或关闭共享。
- **冲突保护**：同时修改不会静默覆盖。先保留本地独立副本，再载入共享版本；断网时本地内容继续保留。

## 使用范围与隐私

本地编辑、图片和 PDF 导出不需要云服务。共享服务没有公开故事列表；不知道邀请密钥的人不能读取故事。链接相当于钥匙，转发链接也会转交权限。这不是绑定朋友账号的访问控制，也不是端到端加密。

只读链接在界面上不可编辑，服务端也拒绝写入。作者密钥只存储在作者浏览器中，不出现在朋友链接中；服务端只保存密钥的 SHA-256 摘要。更换邀请会撤销旧的朋友链接，关闭共享会移除服务端正文并撤销访问，但无法收回朋友已经下载的副本。

不要把 `.local/`、浏览器存储或邀请链接提交到 GitHub。R2 存储桶保持私有，不要开启公开访问。

## 本机启动

需要 Node.js 22 或更新版本：

```sh
npm install --ignore-scripts
npm test
npm run dev
```

打开终端显示的本机地址（默认 `http://127.0.0.1:8787`）。共享内容保存在 `.local/rooms`，服务重启后仍可读取。不要同时运行多个进程并共用同一数据目录。本地文件服务用于本机验证；朋友跨网络访问请部署下方 HTTPS 服务。

## GitHub Pages

现有工作流会安装依赖、运行测试、打包，然后只发布 `dist`。GitHub Pages 能提供编辑与导出页面，但不能直接运行共享保存服务。

如果页面继续使用 GitHub Pages，部署共享服务后，在仓库 Actions 变量中设置 `STORY_CLOUD_ORIGIN` 为该服务 HTTPS 地址（不要末尾斜杠），再运行 Pages 工作流。朋友邀请仍指向 GitHub Pages，保留同一页面地址。

## 在线私密共享服务

项目已提供 Cloudflare Workers + 私有 R2 的配置 `wrangler.jsonc`。需要在自己的 Cloudflare 账号中启用 Workers 和 R2，然后执行：

```sh
npm run build
npx wrangler login
npx wrangler r2 bucket create story-studio-private
npx wrangler deploy
```

不要重复创建已存在的同名桶。登录、账号开通和相关费用选择由账号本人完成。整个工具也可直接通过部署得到的 Workers HTTPS 地址使用；此时不需要设置 `STORY_CLOUD_ORIGIN`。

服务使用 R2 的条件写入来检查同时修改；配置依据 [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) 和 [Workers 静态资源绑定](https://developers.cloudflare.com/workers/static-assets/binding/)。

## 验证

`npm test` 覆盖权限、邀请撤销、持久化、同时写入和同步时序。`scripts/check-ui.mjs` 是浏览器验收脚本，需要 Playwright、Edge，以及 `STUDIO_NODE_PACKAGES` 指向包含 Playwright 的依赖目录。它只创建测试故事，输出位于被 Git 忽略的 `.local/checks/`。

