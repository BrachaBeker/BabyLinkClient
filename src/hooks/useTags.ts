// רשימת התגיות (GET /api/tags) כמעט לא משתנה - טוענים פעם אחת ושומרים בזיכרון לכל המסכים.
import { useEffect, useState } from 'react'
import { babylinkApi } from '../api/babylink'
import type { Tag } from '../api/types'

let cache: Tag[] | null = null

export function useTags() {
  const [tags, setTags] = useState<Tag[]>(cache ?? [])
  const [loading, setLoading] = useState(cache === null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (cache) return
    const controller = new AbortController()
    babylinkApi
      .getTags(controller.signal)
      .then((result) => {
        cache = [...result].sort((a, b) => a.name.localeCompare(b.name, 'he'))
        setTags(cache)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error(err)
        setError(true)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return { tags, loading, error }
}
