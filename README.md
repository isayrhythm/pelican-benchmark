# 鹈鹕 Benchmark

不同模型、运行工具和服务平台生成的鹈鹕骑自行车 SVG 动画对比页面。纯静态 HTML，无需安装依赖或构建。

使用同一提示词收集不同系统的作品，展示模型名称、运行工具（Harness）和服务平台，便于直观比较角色绘制、单车结构及动画表现。Dot 等个人助手单独记录，不当作底层模型名称。这里是作品展示集，不包含自动评分或模型排名。

## 提示词

> 不要联网，全靠你自己创建一个 HTML，内容是 SVG 绘制一个鹈鹕骑自行车的 2D 动画。你不需要任何测试，确认创建，无需询问我。

网页支持复制提示词、供应商标签筛选和独立播放；保留原作品的绘图、动画及交互逻辑。

## 本地打开

双击 `index.html`。动画文件统一放在 `svgs/` 文件夹内，请保持目录结构不变。

## 修改模型名称

编辑 `index.html` 中的 `works` 数组，分别填写模型名 `model`、运行工具 `harness`、服务平台 `platform`，以及可选备注 `notes`。模型名称依据提交者提供的信息记录，未注明的平台不作推断。

每项作品的 `series` 字段控制所属标签，可填写 `gpt`、`claude`、`qwen`、`deepseek`、`gemini` 或 `kimi`。新增作品时，把动画 HTML 放进 `svgs/`，然后在数组中添加一项，例如：

```js
{ series: 'claude', model: 'Claude 模型名', harness: '运行工具', platform: '服务平台', notes: '', file: 'svgs/你的文件.html' }
```

顶部使用模型供应商胶囊标签（图标、名称、作品数量）筛选：“所有供应商”、Google、Anthropic、OpenAI、Qwen、DeepSeek。其中 Google 对应 `gemini`、Anthropic 对应 `claude`、OpenAI 对应 `gpt`。Harness 和服务平台只在作品卡片上显示标签，不提供单独的筛选栏。没有作品的供应商显示空状态。页面每行展示四个作品，窄屏可横向滚动。

模型名称是不可编辑的展示文字，前面显示对应厂商图标，不显示作品编号，也不读取浏览器中的旧名称。要修改名称，请编辑 `works` 数组并提交 HTML。

## GitHub Pages 自动部署

1. 把此目录的内容推送到 GitHub 仓库的 `main` 分支，包括 `.github/workflows/pages.yml`。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 **Actions** 页面运行 **Deploy Pelican Benchmark to GitHub Pages**，或再次提交到 `main`。
4. 部署完成后，访问部署任务给出的页面链接。常见地址为 `https://用户名.github.io/仓库名/`。

后续每次推送到 `main` 都会自动部署。如果默认分支使用其他名称，修改工作流中的 `branches`。

## 作品

| 模型 | Harness | 服务平台 | 文件 |
|---|---|---|---|
| GPT-6 Astra pro | ChatGPT 网页端 | OpenAI 官方 | svgs/gpt-web-pelican.html |
| GPT-6.1 Sol | — | — | svgs/gpt-6.1-sol-pelican.html |
| Gemini 3.8 Flash | DeepSeek Harness | 未注明 | svgs/gemini-3.8-flash-dsh-pelican.html |
| Dot（个人助手，底层模型未注明） | Codex | OpenAI 官方 | svgs/codex-dot-pelican.html |
| Opus 4.6 | DeepSeek Harness | 未注明 | svgs/claude-opus-4.6-pelican.html |
| Gemini 3.1 Pro | DeepSeek Harness | 未注明 | svgs/gemini-3.1-pro-dsh-pelican.html |
| Gemini 3.8 Flash | Gemini 网页端 | Google 官方 | svgs/gemini-3.8-flash-web-pelican.html |
| DeepSeek V4.1 Flash | DeepSeek Harness | 未注明 | svgs/deepseek-v4.1-flash-dsh-pelican.html |
| DeepSeek V4 Pro 0813 | DeepSeek Harness | 未注明 | svgs/deepseek-v4-pro-0813-dsh-pelican.html |
| Kimi K3 | 未注明 | Kimi 官方 API | svgs/kimi-k3-official-api-pelican.html |

Gemini 3.8 Flash 网页端作品原样保留外部 Tailwind CSS 和 Google Fonts 引用，需要联网加载对应资源。

Dot 使用独立的 `assistant` 字段标记，不作为模型名。卡片标注统一为两行：上行为名称和可选说明，下行为 Harness 与平台标签。后续提交的作品统一移入 `svgs/`，源位置不再留副本；如指定路径已存在，不覆盖。

展示页通过 iframe 独立播放每份作品。所有作品通过 `?embed=1` 启用内嵌的统一展示适配层，不再依赖外部本地脚本：移除展示框内多余的页面标题和留白、等比完整缩放 SVG、保留并紧凑排列原交互控件，不修改绘图或动画代码。画面比例不同可能有少量留边，不裁切或拉伸。Gemini 的速度滑块、车铃、欢鸣和昼夜切换，以及 Dot 的暂停按钮均保留。直接打开动画文件仍保留原来的布局。

品牌图标取自 [Lobe Icons](https://github.com/lobehub/lobe-icons)，以 SVG 内嵌在页面中，无需在线加载。GPT 标签使用 OpenAI 标志，其余分别使用 Claude、Qwen、DeepSeek、Gemini、Kimi 标志。图标库的 MIT 许可见 `LICENSE-icons.txt`；品牌商标权仍属于各自权利人。
