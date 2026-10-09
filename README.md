# 每日观心

一个本地优先的静态观心记录工具：见念、知念、转念、不住念。

## 本地预览

```sh
python3 -m http.server 5177 --directory dist
```

然后打开：

```text
http://localhost:5177/
```

## GitHub Pages

仓库包含 GitHub Actions workflow，会把 `dist/` 目录部署到 GitHub Pages。
