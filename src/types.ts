export type Point = { x: number; y: number }

export type CharacterDef = {
  name: string
  codename: string
  smashggName: string
}

export type PackMeta = {
  id: string
  name: string
  path: string
  description: string
}

export type GameMeta = {
  code: string
  name: string
  packs: PackMeta[]
}

export type Catalog = Record<string, GameMeta>

export type PackConfig = {
  name: string
  prefix: string
  postfix: string
  type?: string[]
  eyesights?: Record<string, Record<string, Point>>
  image_sizes?: Record<string, Record<string, Point>>
  skin_mapping?: Record<string, Record<string, number>>
}

export type CharacterPick = {
  /** StreamHelperAssets 角色码；自定义图时可为空 */
  codename: string
  skin: number
  /** 选手自己上传的立绘；有值时优先于素材包 */
  customImageDataUrl?: string
  /** 立绘缩放，1 为默认；越大越充满选手框 */
  artScale?: number
  /** 自定义图焦点（图上归一化坐标，0–1）；仅 customImageDataUrl 有值时生效 */
  imageFocusX?: number
  imageFocusY?: number
}

/** 组队赛中的一名队员。立绘用 characters[0]。 */
export type TeamMember = {
  tag: string
  prefix: string
  twitter: string
  characters: CharacterPick[]
}

export type PlayerSlot = {
  placement: number
  /** 单人赛为选手名；组队赛为队名 */
  tag: string
  prefix: string
  twitter: string
  characters: CharacterPick[]
  /** 组队赛队员。teamMode 打开且有队员时，名次框内并排画每人立绘 */
  members?: TeamMember[]
}

export type BuiltInLayoutId =
  | 'classic'
  | 'podium'
  | 'squares'
  | 'tokon'
  | 'paragon'
  | 'animefgc'
  | 'ebifc'
  | 'prism'

export type LayoutId = BuiltInLayoutId | 'custom'

export type PosterLocale = 'zh' | 'en'

export type HeaderStyleId =
  | 'compact'
  | 'banner'
  | 'hero'
  | 'bottom'
  | 'tokon'
  | 'paragon'
  | 'animefgc'
  | 'ebifc'
  | 'prism'

/** 副选角色展示方式 */
export type ExtraCharStyleId = 'bottomRow' | 'sideStack' | 'custom'

/** 选手 ID 展示方式 */
export type PlayerIdStyleId = 'overlay' | 'inCard' | 'hang' | 'custom'

/** 副角色布局细调（extraCharStyleId 为 custom 时使用） */
export type ExtraCharLayoutConfig = {
  mode?: 'bottomRow' | 'sideStack'
  thumbSize?: number
  gap?: number
  paddingRight?: number
  paddingBottom?: number
}

/** 选手 ID 区域细调（playerIdStyleId 为 custom 时使用） */
export type PlayerIdLayoutConfig = {
  plateHeight?: number
  hangGap?: number
  paddingX?: number
  paddingTop?: number
  /** 叠字模式渐变起点（相对框高 0–1） */
  veilStartRatio?: number
  /** 叠字模式底部暗化强度 0–1 */
  veilOpacity?: number
}

/** 布局级主题渲染参数（立绘缩放、渐变、名条高度等） */
export type LayoutThemeConfig = {
  /** 立绘 cover 倍率，默认 1.15 */
  artCoverMultiplier?: number
  /** 通用槽位立绘额外缩放倍率 */
  slotArtBoost?: number
  /** 叠字模式渐变起点 0–1 */
  overlayVeilStartRatio?: number
  /** 框内名条模式渐变起点 0–1 */
  overlayVeilStartRatioInCard?: number
  /** 叠字模式渐变强度 0–1 */
  overlayVeilOpacity?: number
  /** 框内名条模式渐变强度 0–1 */
  overlayVeilOpacityInCard?: number
  /** 推特条高度 px */
  twitterStripH?: number
  /** 竞技方格：冠军名条高度 */
  paragonChampPlateH?: number
  /** 竞技方格：其他名次名条高度 */
  paragonPlateH?: number
  /** AnimeFGC：冠军底栏高度 */
  animefgcChampBarH?: number
  /** AnimeFGC：冠军立绘缩放加成 */
  animefgcChampArtBoost?: number
  /** AnimeFGC：列表立绘缩放加成 */
  animefgcListArtBoost?: number
  /** AnimeFGC：冠军区渐变起点（相对 artH 0–1） */
  animefgcChampVeilStart?: number
}

/** 选手框主题 */
export type BoxThemeId =
  | 'rank'
  | 'accent'
  | 'monochrome'
  | 'neon'
  | 'minimal'
  | 'custom'
  | 'image'

export type BoxStyle = {
  theme: BoxThemeId
  /** 主色 / 边框色（custom、image 等） */
  color?: string
  borderColor?: string
  /** 框内底色 */
  fillColor?: string
  /** 底色不透明度 0–1 */
  fillOpacity?: number
  /** 边框宽度 px */
  borderWidth?: number
  /** 边框不透明度 0–1 */
  borderOpacity?: number
  /** 主框装饰图 */
  frameImageUrl?: string
  /** 副角色框独立主题；不设则沿用主框 */
  extraTheme?: BoxThemeId
  extraColor?: string
  extraBorderColor?: string
  /** 副框底色；不设则沿用 fillColor */
  extraFillColor?: string
  extraFillOpacity?: number
  extraBorderWidth?: number
  extraBorderOpacity?: number
  extraBorderRadius?: number
  extraFrameImageUrl?: string
}

/** 文本框内容：自动从文档/选手数据读取，或固定文字 */
export type TextContentMode = 'auto' | 'fixed'

export type SlotTextContentSource =
  | 'rank'
  | 'name'
  | 'twitter'
  | 'roster'
  | 'prefix'
  | 'tag'

export type HeaderTextContentSource =
  | 'tournamentName'
  | 'subtitle'
  | 'metaLine'
  | 'top8Label'
  | 'resultsLabel'
  | 'date'
  | 'numEntrants'

export type TextContentSource = SlotTextContentSource | HeaderTextContentSource

/** 可拖拽文本框布局（标题栏 / 选手框 / 页脚） */
export type TextBoxLayout = {
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  fontId?: string
  color?: string
  align?: 'left' | 'center' | 'right'
  fontWeight?: string
  visible?: boolean
  /** 自定义文字框 id（extras 内必填） */
  id?: string
  /** 编辑器内显示名称 */
  label?: string
  contentMode?: TextContentMode
  contentSource?: TextContentSource
  fixedText?: string
}

/** 可拖拽图片区域（Logo 等） */
export type ImageBoxLayout = {
  x: number
  y: number
  w: number
  h: number
  visible?: boolean
}

/** 标题栏文字与 Logo 元素 */
export type HeaderLayoutTexts = {
  tournamentName?: TextBoxLayout
  subtitle?: TextBoxLayout
  metaLine?: TextBoxLayout
  top8Label?: TextBoxLayout
  resultsLabel?: TextBoxLayout
  customLogo?: ImageBoxLayout
  gameLogo?: ImageBoxLayout
  /** 用户添加的额外文字框 */
  extras?: TextBoxLayout[]
}

/** 选手框内文字元素 */
export type SlotTextLayout = {
  rank?: TextBoxLayout
  name?: TextBoxLayout
  twitter?: TextBoxLayout
  roster?: TextBoxLayout
  /** 用户添加的额外文字框 */
  extras?: TextBoxLayout[]
}

/** 标题栏区域与视觉参数 */
export type HeaderRegion = {
  x: number
  y: number
  w: number
  h: number
  /** 背景不透明度 0–1 */
  backgroundOpacity?: number
  /** 背景色 hex */
  backgroundColor?: string
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  /** 底部强调条高度（横幅/斗魂等） */
  accentBarHeight?: number
}

export type Top8Doc = {
  tournamentName: string
  subtitle: string
  date: string
  /** 参赛人数；start.gg 导入时写入，可手改；空字符串表示不显示 */
  numEntrants: string
  /** 海报文案语言：影响标题区「参赛者 / participants」等 */
  posterLocale: PosterLocale
  /** 标题栏样式 */
  headerStyleId: HeaderStyleId
  /** 副选角色展示样式 */
  extraCharStyleId: ExtraCharStyleId
  /** extraCharStyleId 为 custom 时的布局参数 */
  extraCharLayout?: ExtraCharLayoutConfig
  /** 选手 ID 展示样式 */
  playerIdStyleId: PlayerIdStyleId
  /** playerIdStyleId 为 custom 时的布局参数 */
  playerIdLayout?: PlayerIdLayoutConfig
  /** 标题区字体 */
  titleFontId: string
  /** 选手名 / ID 字体 */
  playerFontId: string
  /** 名次标签字体（1ST 等） */
  rankFontId: string
  /** 全局默认选手框样式 */
  defaultBoxStyle: BoxStyle
  gameCode: string
  packId: string
  layoutId: LayoutId
  /** layoutId 为 custom 时使用；也可在布局库中复用 */
  customLayout: CustomLayoutDef | null
  accent: string
  /** 纯色背景（无自定义背景图时使用，有图时作遮罩底色） */
  background: string
  /** 自定义背景图（data URL 或 /user-assets/ 路径） */
  backgroundImageDataUrl: string
  /** 背景图上的暗化强度 0–1，便于文字可读 */
  backgroundDim: number
  /** 选手框底色不透明度 0–1；0 完全透出海报背景，1 为深色底 */
  playerBoxOpacity: number
  showCredits: boolean
  /** 是否在选手 ID 下方显示副角色名；默认 true */
  showExtraCharNames: boolean
  /** 全局立绘缩放，1 为默认；与单角色 artScale 相乘 */
  globalArtScale: number
  logoDataUrl: string
  players: PlayerSlot[]
  /**
   * 组队赛模式。打开后每个名次框并排展示队员立绘，队名用选手 tag。
   * 导入 start.gg / parry.gg 组队赛时自动打开。
   */
  teamMode: boolean
  /** 主界面手动改过、不再跟随 customLayout 默认值的字段 */
  layoutOverrides?: {
    background?: boolean
    extraChar?: boolean
    playerId?: boolean
  }
}

export type LayoutSlot = {
  playerIndex: number
  x: number
  y: number
  w: number
  h: number
  focusX: number
  focusY: number
  nameSize: number
  placeSize: number
  radius: number
  /** 单槽框体样式；覆盖全局 defaultBoxStyle */
  boxStyle?: BoxStyle
  /** 选手框内文字/标签自定义位置与样式 */
  textLayout?: SlotTextLayout
}

export type LayoutTheme = 'default' | 'tokon' | 'paragon' | 'animefgc' | 'ebifc' | 'prism'

/** 标题栏 / 选手框文字：内置主题绘制 或 自定义文字框 */
export type LayoutTextRenderMode = 'theme' | 'custom'

/** 用户自定义或可导出的布局定义 */
export type CustomLayoutDef = {
  id: string
  name: string
  description: string
  width: number
  height: number
  header: HeaderRegion
  slots: LayoutSlot[]
  theme?: LayoutTheme
  recommendedHeaderStyleId?: HeaderStyleId
  recommendedExtraCharStyleId?: ExtraCharStyleId
  recommendedExtraCharLayout?: ExtraCharLayoutConfig
  recommendedPlayerIdStyleId?: PlayerIdStyleId
  recommendedPlayerIdLayout?: PlayerIdLayoutConfig
  /** 布局内标题栏样式 */
  headerStyleId?: HeaderStyleId
  /** 编辑器预览用副角色数量 */
  previewExtraCount?: number
  /** 标题栏自定义背景图 */
  headerImageUrl?: string
  /** 布局级字体（应用到海报时写入 doc） */
  titleFontId?: string
  playerFontId?: string
  rankFontId?: string
  /** 布局级默认框体样式 */
  defaultBoxStyle?: BoxStyle
  /** 布局默认强调色（应用到海报时写入 doc.accent） */
  recommendedAccent?: string
  /** 布局背景图（data URL 或路径） */
  backgroundImageDataUrl?: string
  /** 布局背景底色 */
  background?: string
  /** 背景图暗化 0–1 */
  backgroundDim?: number
  /** 布局默认自定义 Logo（如品牌 Logo） */
  customLogoDataUrl?: string
  /** @deprecated 使用 backgroundImageDataUrl */
  previewBackgroundDataUrl?: string
  /** 标题栏文字与 Logo 布局 */
  headerTexts?: HeaderLayoutTexts
  /** 标题栏文字绘制：theme=内置标题栏样式，custom=使用 headerTexts */
  headerTextMode?: LayoutTextRenderMode
  /** 选手框 ID/名次绘制：theme=内置名条/叠字，custom=使用各槽 textLayout */
  slotTextMode?: LayoutTextRenderMode
  /** 布局级主题渲染参数 */
  recommendedThemeConfig?: LayoutThemeConfig
  /** 页脚素材来源文字 */
  creditsText?: TextBoxLayout
  /** 文字坐标相对父框（标题栏/选手框）；旧布局导入时会自动迁移 */
  textCoordsRelative?: boolean
  /** 基于哪个内置模板创建 */
  basedOn?: BuiltInLayoutId
  createdAt?: string
  updatedAt?: string
}

export type Layout = {
  id: LayoutId | string
  name: string
  description: string
  width: number
  height: number
  header: HeaderRegion
  slots: LayoutSlot[]
  /** 渲染主题；tokon 为参考图斗魂风格 */
  theme?: LayoutTheme
  /** 推荐搭配的标题栏 */
  recommendedHeaderStyleId?: HeaderStyleId
  recommendedExtraCharStyleId?: ExtraCharStyleId
  recommendedPlayerIdStyleId?: PlayerIdStyleId
  /** 选用该布局时推荐的强调色 */
  recommendedAccent?: string
  /** 选用该布局时推荐的背景色 */
  recommendedBackground?: string
  /** 选用该布局时推荐的背景图 */
  recommendedBackgroundImageDataUrl?: string
  /** 选用该布局时推荐的自定义 Logo */
  recommendedCustomLogoUrl?: string
  /** 选用该布局时推荐的背景暗化 0–1 */
  recommendedBackgroundDim?: number
  /** 选用该布局时推荐的框体默认样式 */
  recommendedDefaultBoxStyle?: BoxStyle
  /** 选用该布局时推荐的选手框底色不透明度 0–1 */
  recommendedPlayerBoxOpacity?: number
  /** 选用该布局时推荐的全局立绘缩放 */
  recommendedGlobalArtScale?: number
  /** 选用该布局时是否显示素材来源 */
  recommendedShowCredits?: boolean
  /** 选用该布局时是否显示副角色名 */
  recommendedShowExtraCharNames?: boolean
  /** 选用该布局时推荐的副角色布局细调 */
  recommendedExtraCharLayout?: ExtraCharLayoutConfig
  /** 选用该布局时推荐的选手 ID 布局细调 */
  recommendedPlayerIdLayout?: PlayerIdLayoutConfig
  /** 选用该布局时推荐的标题字体 */
  recommendedTitleFontId?: string
  /** 选用该布局时推荐的选手名字体 */
  recommendedPlayerFontId?: string
  /** 选用该布局时推荐的名次字体 */
  recommendedRankFontId?: string
}
