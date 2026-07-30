"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Pill,
  Search,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Navigation,
  Star,
} from "lucide-react"
import Link from "next/link"

export default function PharmacyPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPharmacy, setSelectedPharmacy] = useState("")

  const pharmacies = [
    {
      id: "1",
      name: "Nabha Medical Store",
      address: "Main Market, Nabha",
      phone: "+91 98765 12345",
      distance: "0.5 km",
      rating: 4.5,
      isOpen: true,
      openHours: "8:00 AM - 10:00 PM",
    },
    {
      id: "2",
      name: "City Pharmacy",
      address: "Civil Hospital Road, Nabha",
      phone: "+91 98765 67890",
      distance: "1.2 km",
      rating: 4.2,
      isOpen: true,
      openHours: "9:00 AM - 9:00 PM",
    },
    {
      id: "3",
      name: "Health Plus Pharmacy",
      address: "Bus Stand, Nabha",
      phone: "+91 98765 54321",
      distance: "2.1 km",
      rating: 4.0,
      isOpen: false,
      openHours: "8:00 AM - 8:00 PM",
    },
    {
      id: "4",
      name: "Wellness Pharmacy",
      address: "Patiala Road, Nabha",
      phone: "+91 98765 98765",
      distance: "3.5 km",
      rating: 4.3,
      isOpen: true,
      openHours: "24 Hours",
    },
  ]

  const medicines = [
    {
      id: "1",
      name: "Paracetamol 500mg",
      genericName: "Acetaminophen",
      category: "Pain Relief",
      availability: [
        { pharmacyId: "1", inStock: true, price: "₹25", quantity: "50+ tablets" },
        { pharmacyId: "2", inStock: true, price: "₹22", quantity: "30+ tablets" },
        { pharmacyId: "3", inStock: false, price: "₹24", quantity: "Out of stock" },
        { pharmacyId: "4", inStock: true, price: "₹26", quantity: "100+ tablets" },
      ],
    },
    {
      id: "2",
      name: "Amlodipine 5mg",
      genericName: "Amlodipine Besylate",
      category: "Blood Pressure",
      availability: [
        { pharmacyId: "1", inStock: true, price: "₹45", quantity: "20+ tablets" },
        { pharmacyId: "2", inStock: false, price: "₹42", quantity: "Out of stock" },
        { pharmacyId: "3", inStock: true, price: "₹44", quantity: "15+ tablets" },
        { pharmacyId: "4", inStock: true, price: "₹46", quantity: "40+ tablets" },
      ],
    },
    {
      id: "3",
      name: "Cough Syrup",
      genericName: "Dextromethorphan",
      category: "Respiratory",
      availability: [
        { pharmacyId: "1", inStock: true, price: "₹85", quantity: "10+ bottles" },
        { pharmacyId: "2", inStock: true, price: "₹82", quantity: "8+ bottles" },
        { pharmacyId: "3", inStock: false, price: "₹84", quantity: "Out of stock" },
        { pharmacyId: "4", inStock: true, price: "₹87", quantity: "25+ bottles" },
      ],
    },
    {
      id: "4",
      name: "Vitamin D3 1000 IU",
      genericName: "Cholecalciferol",
      category: "Vitamins",
      availability: [
        { pharmacyId: "1", inStock: true, price: "₹120", quantity: "30+ capsules" },
        { pharmacyId: "2", inStock: true, price: "₹115", quantity: "25+ capsules" },
        { pharmacyId: "3", inStock: true, price: "₹118", quantity: "20+ capsules" },
        { pharmacyId: "4", inStock: false, price: "₹122", quantity: "Out of stock" },
      ],
    },
    {
      id: "5",
      name: "Insulin Glargine",
      genericName: "Long-acting Insulin",
      category: "Diabetes",
      availability: [
        { pharmacyId: "1", inStock: false, price: "₹850", quantity: "Out of stock" },
        { pharmacyId: "2", inStock: true, price: "₹820", quantity: "5+ vials" },
        { pharmacyId: "3", inStock: false, price: "₹840", quantity: "Out of stock" },
        { pharmacyId: "4", inStock: true, price: "₹860", quantity: "8+ vials" },
      ],
    },
  ]

  const filteredMedicines = medicines.filter(
    (medicine) =>
      medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getAvailabilityStatus = (medicine: any) => {
    const availableCount = medicine.availability.filter((a: any) => a.inStock).length
    if (availableCount === 0) return { status: "unavailable", text: "Not Available", color: "text-red-600" }
    if (availableCount <= 2) return { status: "limited", text: "Limited Stock", color: "text-amber-600" }
    return { status: "available", text: "Available", color: "text-green-600" }
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
              <Pill className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Medicine Tracker</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Find Medicines</CardTitle>
              <CardDescription>Search for medicines and check availability at nearby pharmacies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by medicine name, generic name, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="medicines" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="medicines" className="flex items-center space-x-2">
                <Pill className="w-4 h-4" />
                <span>Medicine Availability</span>
              </TabsTrigger>
              <TabsTrigger value="pharmacies" className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>Nearby Pharmacies</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="medicines" className="space-y-4">
              {filteredMedicines.map((medicine) => {
                const availability = getAvailabilityStatus(medicine)
                return (
                  <Card key={medicine.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Pill className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{medicine.name}</CardTitle>
                            <CardDescription>
                              {medicine.genericName} • {medicine.category}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${availability.color} border-current`}>
                          {availability.status === "available" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {availability.status === "limited" && <AlertCircle className="w-3 h-3 mr-1" />}
                          {availability.status === "unavailable" && <XCircle className="w-3 h-3 mr-1" />}
                          {availability.text}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {medicine.availability.map((avail: any) => {
                          const pharmacy = pharmacies.find((p) => p.id === avail.pharmacyId)
                          return (
                            <div
                              key={avail.pharmacyId}
                              className={`p-4 rounded-lg border ${
                                avail.inStock ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-sm">{pharmacy?.name}</h4>
                                {avail.inStock ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex justify-between">
                                  <span>Price:</span>
                                  <span className="font-medium">{avail.price}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Stock:</span>
                                  <span className={avail.inStock ? "text-green-600" : "text-red-600"}>
                                    {avail.quantity}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Distance:</span>
                                  <span>{pharmacy?.distance}</span>
                                </div>
                              </div>
                              {avail.inStock && (
                                <Button size="sm" className="w-full mt-3 text-xs">
                                  Reserve Medicine
                                </Button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            <TabsContent value="pharmacies" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pharmacies.map((pharmacy) => (
                  <Card key={pharmacy.id} className={pharmacy.isOpen ? "border-green-200" : "border-red-200"}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Pill className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{pharmacy.name}</CardTitle>
                            <CardDescription className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{pharmacy.address}</span>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={pharmacy.isOpen ? "secondary" : "outline"} className="mb-1">
                            {pharmacy.isOpen ? "Open" : "Closed"}
                          </Badge>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                            <span>{pharmacy.rating}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>Hours:</span>
                          </div>
                          <span className="font-medium">{pharmacy.openHours}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Navigation className="w-4 h-4 text-muted-foreground" />
                            <span>Distance:</span>
                          </div>
                          <span className="font-medium">{pharmacy.distance}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>Phone:</span>
                          </div>
                          <span className="font-medium">{pharmacy.phone}</span>
                        </div>
                        <div className="flex space-x-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                            <Phone className="w-4 h-4 mr-2" />
                            Call
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                            <Navigation className="w-4 h-4 mr-2" />
                            Directions
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <Card className="mt-8 bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">Emergency Medicine Request</h3>
                  <p className="text-sm text-amber-700 mb-3">
                    Can't find a critical medicine? Contact Nabha Civil Hospital for emergency assistance or alternative
                    arrangements.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100 bg-transparent"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Emergency Contact: +91 98765 00000
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
