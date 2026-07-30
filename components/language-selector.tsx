"use client"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"
import type { Language } from "@/lib/translations"
import { supportedLanguages } from "@/lib/translations"
import { useLanguage } from "./language-provider"

const languages = supportedLanguages

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const currentLang = languages.find((l) => l.code === language)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2 bg-transparent">
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{currentLang?.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
        {languages.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLanguage(l.code)} className={language === l.code ? "bg-primary/10" : ""}>
            <div className="flex flex-col">
              <span className="font-medium">{l.nativeName}</span>
              <span className="text-xs text-muted-foreground">{l.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
