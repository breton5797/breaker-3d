// Display names in the current language for things the sim knows by id: maps (with their
// sunset/night variant), bosses, fruit, achievements. The sim's own Korean names stay as they
// are (data and tests); only what is shown goes through here.
import { t } from './i18n.js';
import { stageSlot } from './sim/sequence.js';
import { bossAt, landmarkAt } from './sim/maps.js';

/** @param {string} id map id @param {string|null} [variant] 'sunset' | 'night' */
export const mapName = (id, variant = null) => t(`map.${id}.name`) + (variant ? ` · ${t(`variant.${variant}`)}` : '');
export const mapSubtitle = (id) => t(`map.${id}.sub`);
/** @param {string} kind a boss kind (boss.js / mapBosses.js) */
export const bossName = (kind) => t(`boss.${kind}`);
export const fruitName = (id) => t(`fruit.${id}`);
export const chapterName = (chapterId) => t(`chapter.${chapterId}`);

/** The stage's title as the HUD shows it: a big boss stage is named after its boss. */
export function stageTitle(level) {
  return level.bossStage ? t('boss.prefix') + mapName(level.id) : mapName(level.id, level.variant);
}

/** The boss bar's name for the stage: the big boss itself, or "BOSS · <map boss>". */
export function bossBarName(level) {
  if (!level.boss) return '';
  return level.bossStage ? mapName(level.id) : t('boss.prefix') + bossName(level.boss.kind);
}

/** The boss's name alone (for its card). */
export const stageBossName = (level) => (level.bossStage ? mapName(level.id) : bossName(level.boss?.kind));

/** @param {number} i stage index @returns {string} its title, without building the stage */
export function stageTitleAt(i) {
  const slot = stageSlot(Math.max(0, Math.floor(i) || 0));
  if (slot.boss) return t('boss.prefix') + mapName(bossAt(slot.bossIndex).id);
  const m = landmarkAt(slot.content);
  return mapName(m.id, m.variant ?? null);
}

/** @param {{ id:string, params?:object }} a an achievement */
export const achievementName = (a) => t(`achv.${a.id}.name`);
export const achievementDesc = (a) => t(`achv.${a.id}.desc`, a.params);
