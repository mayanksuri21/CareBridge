"use client"
import { useState, useCallback } from "react"

interface UseCharacterLimitProps {
  maxLength: number
  initialValue?: string
}

interface UseCharacterLimitReturn {
  value: string
  characterCount: number
  maxLength: number
  handleChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  setValue: (value: string) => void
}

export function useCharacterLimit({
  maxLength,
  initialValue = "",
}: UseCharacterLimitProps): UseCharacterLimitReturn {
  const [value, setValue] = useState(initialValue)

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value
      if (newValue.length <= maxLength) {
        setValue(newValue)
      }
    },
    [maxLength]
  )

  return {
    value,
    characterCount: value.length,
    maxLength,
    handleChange,
    setValue,
  }
}