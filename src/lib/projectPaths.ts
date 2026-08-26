/** 项目内按游戏分目录的文件夹说明（与 vite 开发服务器写入路径一致） */
export const PROJECT_PATHS = {
  /** StreamHelperAssets 代理缓存：`.sha-cache/games/{gameCode}/…` */
  shaCache: '.sha-cache',
  /** 用户上传图：`public/user-assets/{gameCode}/…` */
  userAssets: 'public/user-assets',
  /** 海报与布局库：`saves/{gameCode}/doc.json`、`layouts.json` */
  saves: 'saves',
} as const

export function saveApiUrl(gameCode: string, kind: 'doc' | 'layouts'): string {
  return `/api/saves/${encodeURIComponent(gameCode)}/${kind}`
}
