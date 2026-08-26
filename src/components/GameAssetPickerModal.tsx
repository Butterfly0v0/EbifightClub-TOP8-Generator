import { useEffect, useMemo, useState } from 'react'
import { gameLogoUrl } from '../lib/assets'
import { filterGames, listGamesFromCatalog } from '../lib/gameList'
import type { Catalog, GameMeta } from '../types'

type Step = 'game' | 'pack'

export type GameSwitchMode = 'archive' | 'keep-roster'

type Props = {
  open: boolean
  catalog: Catalog
  initialGameCode?: string
  initialPackId?: string
  title?: string
  onClose: () => void
  onConfirm: (gameCode: string, packId: string, mode: GameSwitchMode) => void
}

function GameLogoThumb({ game }: { game: GameMeta }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="game-picker-logo-fallback" aria-hidden="true">
        {game.name.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      className="game-picker-logo"
      src={gameLogoUrl(game.code)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

export default function GameAssetPickerModal({
  open,
  catalog,
  initialGameCode,
  initialPackId,
  title = '选择游戏素材',
  onClose,
  onConfirm,
}: Props) {
  const games = useMemo(() => listGamesFromCatalog(catalog), [catalog])
  const [step, setStep] = useState<Step>('game')
  const [query, setQuery] = useState('')
  const [selectedGame, setSelectedGame] = useState<GameMeta | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('game')
    setQuery('')
    const preset = initialGameCode ? catalog[initialGameCode] : null
    setSelectedGame(preset ?? null)
  }, [open, initialGameCode, catalog])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const filtered = filterGames(games, query)

  const pickGame = (game: GameMeta) => {
    setSelectedGame(game)
    setStep('pack')
    setQuery('')
  }

  const pickPack = (packId: string) => {
    if (!selectedGame) return
    onConfirm(selectedGame.code, packId, 'archive')
    onClose()
  }

  return (
    <div
      className="game-picker-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="game-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-picker-title"
      >
        <header className="game-picker-header">
          <div className="game-picker-header-main">
            {step === 'pack' && selectedGame ? (
              <button
                type="button"
                className="ghost tiny game-picker-back"
                onClick={() => setStep('game')}
              >
                ← 返回
              </button>
            ) : null}
            <h3 id="game-picker-title">{step === 'game' ? title : `选择素材包 · ${selectedGame?.name}`}</h3>
          </div>
          <button type="button" className="ghost tiny game-picker-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        {step === 'game' ? (
          <>
            <div className="game-picker-search-wrap">
              <input
                className="game-picker-search"
                type="search"
                placeholder="搜索游戏名称…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="game-picker-grid" role="listbox" aria-label="游戏列表">
              {filtered.length === 0 ? (
                <p className="game-picker-empty">没有匹配的游戏</p>
              ) : (
                filtered.map((game) => (
                  <button
                    key={game.code}
                    type="button"
                    className={`game-picker-card${initialGameCode === game.code ? ' current' : ''}`}
                    role="option"
                    aria-selected={initialGameCode === game.code}
                    onClick={() => pickGame(game)}
                  >
                    <GameLogoThumb game={game} />
                    <span className="game-picker-name">{game.name}</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : selectedGame ? (
          <div className="game-picker-pack-list">
            {selectedGame.packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={`game-picker-pack${initialPackId === pack.id && initialGameCode === selectedGame.code ? ' current' : ''}`}
                onClick={() => pickPack(pack.id)}
              >
                <span className="game-picker-pack-name">{pack.name}</span>
                {pack.description ? (
                  <span className="game-picker-pack-desc">{pack.description}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
