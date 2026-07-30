"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  MessageSquare,
  Send,
  ArrowLeft,
  Clock,
  User,
  Stethoscope,
} from "lucide-react"
import Link from "next/link"

export default function ConsultationPage() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [chatMessage, setChatMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([
    { sender: "system", message: "Welcome to your consultation. The doctor will join shortly.", time: "10:30 AM" },
  ])
  const [selectedDoctor, setSelectedDoctor] = useState("")
  const [consultationReason, setConsultationReason] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)

  const availableDoctors = [
    {
      id: "1",
      name: "Dr. Rajesh Kumar",
      specialty: "General Medicine",
      available: true,
      language: "Hindi, Punjabi, English",
    },
    { id: "2", name: "Dr. Priya Sharma", specialty: "Pediatrics", available: true, language: "Hindi, English" },
    { id: "3", name: "Dr. Amrit Singh", specialty: "Cardiology", available: false, language: "Punjabi, English" },
    { id: "4", name: "Dr. Sunita Kaur", specialty: "Gynecology", available: true, language: "Hindi, Punjabi" },
  ]

  useEffect(() => {
    if (isCallActive && videoRef.current) {

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((err) => console.log("Camera access denied:", err))
    }
  }, [isCallActive])

  const startConsultation = () => {
    if (!selectedDoctor || !consultationReason) {
      alert("Please select a doctor and provide consultation reason")
      return
    }
    setIsCallActive(true)
    setChatMessages((prev) => [
      ...prev,
      {
        sender: "system",
        message: `Connecting you with ${availableDoctors.find((d) => d.id === selectedDoctor)?.name}...`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])
  }

  const endConsultation = () => {
    setIsCallActive(false)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }
  }

  const sendMessage = () => {
    if (chatMessage.trim()) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "patient",
          message: chatMessage,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
      setChatMessage("")

      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "doctor",
            message: "Thank you for sharing that information. Let me examine this further.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      }, 2000)
    }
  }

  if (isCallActive) {
    return (
      <div className="min-h-screen bg-background">
        
        <header className="border-b border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">
                  {availableDoctors.find((d) => d.id === selectedDoctor)?.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {availableDoctors.find((d) => d.id === selectedDoctor)?.specialty}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Connected
              </Badge>
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>05:23</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex h-[calc(100vh-80px)]">
          
          <div className="flex-1 bg-gray-900 relative">
            
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-12 h-12 text-primary-foreground" />
                </div>
                <p className="text-lg font-medium">{availableDoctors.find((d) => d.id === selectedDoctor)?.name}</p>
                <p className="text-sm opacity-75">Video call in progress</p>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
              {isVideoOn ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center space-x-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3">
                <Button
                  variant={isMicOn ? "secondary" : "destructive"}
                  size="sm"
                  className="rounded-full w-12 h-12"
                  onClick={() => setIsMicOn(!isMicOn)}
                >
                  {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button
                  variant={isVideoOn ? "secondary" : "destructive"}
                  size="sm"
                  className="rounded-full w-12 h-12"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
                <Button variant="destructive" size="sm" className="rounded-full w-12 h-12" onClick={endConsultation}>
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="w-80 border-l border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === "patient" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.sender === "patient"
                        ? "bg-primary text-primary-foreground"
                        : msg.sender === "doctor"
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-75 mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex space-x-2">
                <Input
                  placeholder="Type your message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1"
                />
                <Button size="sm" onClick={sendMessage}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Video className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Video Consultation</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Start Your Consultation</CardTitle>
              <CardDescription>Connect with qualified doctors from Nabha Civil Hospital</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Select Doctor</label>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an available doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDoctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id} disabled={!doctor.available}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-medium">{doctor.name}</div>
                            <div className="text-sm text-muted-foreground">{doctor.specialty}</div>
                            <div className="text-xs text-muted-foreground">{doctor.language}</div>
                          </div>
                          <Badge variant={doctor.available ? "secondary" : "outline"} className="ml-2">
                            {doctor.available ? "Available" : "Busy"}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Reason for Consultation</label>
                <Textarea
                  placeholder="Please describe your symptoms or health concerns..."
                  value={consultationReason}
                  onChange={(e) => setConsultationReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <Button
                onClick={startConsultation}
                className="w-full"
                size="lg"
                disabled={!selectedDoctor || !consultationReason}
              >
                <Video className="w-5 h-5 mr-2" />
                Start Video Consultation
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableDoctors.map((doctor) => (
              <Card key={doctor.id} className={`${doctor.available ? "border-primary/20" : "opacity-60"}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Stethoscope className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{doctor.name}</CardTitle>
                        <CardDescription>{doctor.specialty}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={doctor.available ? "secondary" : "outline"}>
                      {doctor.available ? "Available" : "Busy"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="font-medium">Languages:</span>
                      <span className="ml-2">{doctor.language}</span>
                    </div>
                    {doctor.available && (
                      <div className="flex items-center text-sm text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        Available for consultation
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
