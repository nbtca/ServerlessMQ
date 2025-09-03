# ServerlessMQ Frontend

基于React的单页应用，提供ServerlessMQ的Web界面。

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build

# 预览构建结果
pnpm run preview
```

## 项目结构

```
src/
  ├── App.tsx          # 主应用组件
  ├── App.css          # 应用样式
  ├── main.tsx         # 应用入口
  ├── index.css        # 全局样式
  └── vite-env.d.ts    # Vite类型定义
```

## 构建说明

构建后的文件会自动放置到 `../backend/src/static` 目录中，供后端静态文件服务使用。
