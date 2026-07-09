import { useState, useEffect } from 'react'

/**
 * Perform a linear fuzzy match to check if character subsequence exists in order.
 * Case-insensitive. Fallback to normal inclusion if subsequence search fails.
 */
export function fuzzyMatch(itemText, query) {
  if (!query) return true
  if (!itemText) return false
  const text = String(itemText).toLowerCase()
  const q = String(query).toLowerCase()
  
  if (text.includes(q)) return true
  
  let qIdx = 0
  for (let tIdx = 0; tIdx < text.length; tIdx++) {
    if (text[tIdx] === q[qIdx]) {
      qIdx++
    }
    if (qIdx === q.length) return true
  }
  return false
}

/**
 * Debounce custom React hook to optimize search inputs and prevent lag.
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
