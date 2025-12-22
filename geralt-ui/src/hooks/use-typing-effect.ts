import { useState, useEffect, useRef } from 'react'

export function useTypingEffect(text: string, speed: number = 20, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text)
      return
    }

    setIsTyping(true)
    setDisplayedText('')
    indexRef.current = 0

    const timer = setInterval(() => {
      if (isPaused) return

      if (indexRef.current < text.length) {
        setDisplayedText((prev) => prev + text.charAt(indexRef.current))
        indexRef.current++
      } else {
        setIsTyping(false)
        clearInterval(timer)
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, enabled, isPaused])

  const pause = () => setIsPaused(true)
  const resume = () => setIsPaused(false)
  const skip = () => {
    setDisplayedText(text)
    setIsTyping(false)
    setIsPaused(false)
  }

  return { displayedText, isTyping, pause, resume, skip }
}
