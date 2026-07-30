"use client"
import { useState, useRef, useCallback, useEffect } from "react"

interface UseImageUploadReturn {
  previewUrl: string | null
  fileInputRef: React.RefObject<HTMLInputElement>
  handleThumbnailClick: () => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  uploadFile: (file: File) => Promise<string | null>
  isUploading: boolean
  error: string | null
  clearPreview: () => void
}

export function useImageUpload(): UseImageUploadReturn {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentUrlRef = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
      }
    }
  }, [])

  const clearPreview = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current)
      currentUrlRef.current = null
    }
    setPreviewUrl(null)
    setError(null)
  }, [])

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        if (currentUrlRef.current) {
          URL.revokeObjectURL(currentUrlRef.current)
        }
        const url = URL.createObjectURL(file)
        currentUrlRef.current = url
        setPreviewUrl(url)
        setError(null)
      } catch (err) {
        setError("Failed to create image preview")
        console.error("Error creating object URL:", err)
      }
    }
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file) {
      setError("No file provided")
      return null
    }
    if (!file.type.startsWith('image/')) {
      setError("File must be an image")
      return null
    }
    const maxSize = 5 * 1024 * 1024 
    if (file.size > maxSize) {
      setError("File size must be less than 5MB")
      return null
    }

    setIsUploading(true)
    setError(null)

    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        
        reader.onloadend = () => {
          const result = reader.result as string
          setIsUploading(false)
          resolve(result)
        }
        
        reader.onerror = () => {
          const error = "Failed to read file"
          setError(error)
          setIsUploading(false)
          reject(new Error(error))
        }
        
        reader.readAsDataURL(file)
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload image"
      setError(errorMessage)
      setIsUploading(false)
      console.error("Upload error:", err)
      return null
    }
  }, [])

  return {
    previewUrl,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    uploadFile,
    isUploading,
    error,
    clearPreview,
  }
}