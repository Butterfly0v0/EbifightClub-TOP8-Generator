import type { ExtraCharStyleId, PlayerIdStyleId } from '../types'

export const EXTRA_CHAR_STYLES: Record<
  ExtraCharStyleId,
  { id: ExtraCharStyleId; name: string; description: string }
> = {
  bottomRow: {
    id: 'bottomRow',
    name: '底部横排',
    description: '副选角色缩略图横排在框内底部（默认）',
  },
  sideStack: {
    id: 'sideStack',
    name: '右侧竖排',
    description: '与主立绘同框，副选在右侧纵向排列',
  },
  custom: {
    id: 'custom',
    name: '自定义布局',
    description: '手动调整缩略图尺寸、间距与边距',
  },
}

export const PLAYER_ID_STYLES: Record<
  PlayerIdStyleId,
  { id: PlayerIdStyleId; name: string; description: string }
> = {
  overlay: {
    id: 'overlay',
    name: '底部叠字',
    description: '选手名叠在立绘底部渐变上',
  },
  inCard: {
    id: 'inCard',
    name: '框内名条',
    description: '框内底部色块显示 ID 与角色列表',
  },
  hang: {
    id: 'hang',
    name: '延伸名条',
    description: '立绘框下方延伸一块专门显示 ID 与角色',
  },
  custom: {
    id: 'custom',
    name: '自定义布局',
    description: '手动调整名条高度、渐变与内边距',
  },
}

export const EXTRA_CHAR_STYLE_LIST = Object.values(EXTRA_CHAR_STYLES)
export const PLAYER_ID_STYLE_LIST = Object.values(PLAYER_ID_STYLES)
