'use client';

/**
 * 根布局自身出错时的兜底（`app/error.tsx` 够不到那一层）。
 *
 * 分工：`app/error.tsx` 能被**根布局之下的任何页面**触发，但它兜不住根布局自己 ——
 * 根布局渲染 Toast / Tooltip 的 Provider 与 Vercel 埋点，出错概率很低，但真出错时
 * Next 会用**这个组件替换掉整套 `<html>` / `<body>`**。两个由此而来的约束：
 *
 * 1. 必须自己渲染 `<html>` 与 `<body>`（根布局没有参与渲染）；
 * 2. **样式表加载不到** —— `globals.css` 是在根布局里 import 的，所以 Tailwind 类名与
 *    设计令牌在这里**全都不生效**。于是这里只用内联样式、色值直接抄自 `globals.css`
 *    的令牌（`ink-50 #f8fafc` / `ink-200 #e2e8f0` / `ink-500 #64748b` /
 *    `ink-900 #0f172a` / `brand-500 #31438c`）。朴素一点，但不会变成一堆没生效的类名。
 *
 * 文案与出口与 `ErrorCard` 保持一致（同一类出错不该有两个说法），
 * 只是那片卡片依赖 Tailwind，这里用不了。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: 24,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            background: '#ffffff',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
            这一步没能完成
          </h1>
          <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.7, color: '#64748b' }}>
            服务端处理这个请求时出错了，不是你填错了什么。
            <br />
            可以重试一次；如果一直这样，把下面的编号发给管理员。
          </p>

          {error.digest ? (
            <p
              style={{
                marginTop: 12,
                marginBottom: 0,
                fontSize: 11,
                color: '#94a3b8',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              错误编号 {error.digest}
            </p>
          ) : null}

          <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: 40,
                padding: '0 20px',
                border: 0,
                borderRadius: 10,
                background: '#31438c',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              重试
            </button>
            {/* 用原生 <a> 而不是 next/link：根布局都坏了的时候，不该再依赖路由上下文 */}
            <a
              href="/app"
              style={{
                height: 40,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 20px',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                background: '#ffffff',
                color: '#334155',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              回到问卷列表
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
