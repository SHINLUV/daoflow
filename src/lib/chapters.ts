import chapters from '../../scripts/seed/chapters.json'

/** Existing seed content also keeps the reading experience available offline. */
export function getLocalChapter(id: number) {
  return chapters.find(chapter => chapter.id === id) ?? null
}
