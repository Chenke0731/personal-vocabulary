---
name: visual-design-extensions
description: 按需参考五项界面设计扩展指令，适用于页面的布局、排版、微交互、阴影及品牌风格设计。
---

# 界面设计扩展指令

来源：用户提供的五项中文截图指令；适合按项目选用，须服从用户要求和现有设计系统。以下为截图文字整理，并非独立的上游 GitHub 技能。

## 呼吸感留白 minimalist-ui-layout

请注入 minimalist-ui-layout 留白标准。严格应用 8px 栅格。所有 Section 上下 Padding 保持 80px 至 120px，通过“组件内紧凑、区块间大留白”打造高级感视觉节奏。

## 无衬线阶梯排版 typography-hierarchy

请注入 typography-hierarchy 排版标准。全局最多 2 种无衬线字体。H1/H2 用 700+ 字重，Letter-spacing: -0.02em；正文 400 字重，行高 1.6–1.8，文字改用 #1A1A1A 等中性深灰。

## 微互动与微动效 smooth-micro-interactions

请注入 smooth-micro-interactions 动效标准。所有 Hover/点击元素使用 transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1)，交互必须伴随 translateY(-2px) 或环境光阴影渐变。

## 环境光阴影 ambient-depth-shadows

请注入 ambient-depth-shadows 阴影标准。禁用默认单层粗糙阴影。必须叠加至少两层低饱和度、高透明度浅色阴影，例如 box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)。严禁生硬高对比纯黑模糊带。

## 语境感知与情感设计 contextual-branding-design

请注入 contextual-branding-design 调性标准。写代码前先声明目标用户与品牌调性。AI 工具/硬核 Tech SaaS 采用暗黑科技风、高饱和霓虹渐变线条与高密度排版；独立开发者作品、宠物网站或个人官网采用 Bento Grid、超大字号、温暖奶油色调与大面积高级留白。

## 使用边界

以上数值和风格为可选参考，不是所有页面的硬性规则。手机学习界面应优先适配屏幕、易读性与操作效率；根据场景调整间距、行高与阴影。动效应尊重系统减少动态效果设置，并为触屏和键盘提供反馈。优先遵从用户要求与具体产品需求，避免将某类产品机械套用同一种风格。
