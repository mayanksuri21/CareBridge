export type Language =
  | "en"
  | "hi"
  | "pa"
  | "bn" 
  | "te" 
  | "ta" 
  | "ml" 
  | "kn" 
  | "gu" 
  | "mr" 
  | "or" 
  | "as" 
  | "ur" 

export interface Translations {

  home: string
  back: string
  next: string
  previous: string
  submit: string
  cancel: string
  loading: string
  search: string

  videoConsultation: string
  healthRecords: string
  medicineTracker: string
  symptomChecker: string
  navFeatures: string
  navHowItWorks: string
  navForPatients: string
  navForDoctors: string

  healthcareAtFingerTips: string
  healthcareDescription: string
  villagesServed: string
  doctorsAvailable: string
  support24x7: string
  startConsultation: string
  viewRecords: string
  checkAvailability: string
  checkSymptoms: string
  availableLanguages: string
  worksOffline: string
  realTimeUpdates: string
  lowBandwidthOptimized: string
  emergencyServices: string
  emergencyDescription: string
  callEmergency: string
  heroSecureTagline: string
  patientCta: string
  doctorCta: string
  videoPause: string
  videoPlay: string
  videoDemoLabel: string

  selectDoctor: string
  reasonForConsultation: string
  startVideoConsultation: string
  connected: string
  endConsultation: string
  chat: string
  typeMessage: string

  patientInfo: string
  consultations: string
  labResults: string
  prescriptions: string
  vitalSigns: string
  exportRecords: string

  findMedicines: string
  medicineAvailability: string
  nearbyPharmacies: string
  available: string
  limitedStock: string
  notAvailable: string
  reserveMedicine: string

  analyzingSymptoms: string
  assessmentResults: string
  recommendedActions: string
  bookConsultation: string
  trackSymptoms: string
  newAssessment: string
  emergencySituation: string
  importantDisclaimer: string
  disclaimerText: string
}

export const translations: Partial<Record<Language, Partial<Translations>>> = {
  en: {

    home: "Home",
    back: "Back",
    next: "Next",
    previous: "Previous",
    submit: "Submit",
    cancel: "Cancel",
    loading: "Loading...",
    search: "Search",

    videoConsultation: "Video Consultation",
    healthRecords: "Health Records",
    medicineTracker: "Medicine Tracker",
    symptomChecker: "Symptom Checker",
  navFeatures: "Features",
  navHowItWorks: "How it works",
  navForPatients: "For patients",
  navForDoctors: "For doctors",

    healthcareAtFingerTips: "Healthcare at your fingertips",
    healthcareDescription:
      "Connect with doctors, manage your health records, and get medical care from 173 villages around Nabha. Quality healthcare, now accessible to all.",
    villagesServed: "Villages Served",
    doctorsAvailable: "Doctors Available",
    support24x7: "24/7 Support",
    startConsultation: "Start Consultation",
    viewRecords: "View Records",
    checkAvailability: "Check Availability",
    checkSymptoms: "Check Symptoms",
    availableLanguages: "Available in Hindi, Punjabi and other Indian languages",
    worksOffline: "Works offline too",
    realTimeUpdates: "Real-time updates",
    lowBandwidthOptimized: "Optimized for low bandwidth",
    emergencyServices: "Emergency Services",
    emergencyDescription: "For medical emergencies, contact Nabha Civil Hospital directly",
    callEmergency: "Call Emergency: 108",
  heroSecureTagline: "Secure, low-bandwidth telehealth for rural India",
  patientCta: "Patient: Get care now",
  doctorCta: "Doctor: Join as provider",
  videoPause: "Pause",
  videoPlay: "Play",
  videoDemoLabel: "Demo video",

    selectDoctor: "Select Doctor",
    reasonForConsultation: "Reason for consultation",
    startVideoConsultation: "Start video consultation",
    connected: "Connected",
    endConsultation: "End consultation",
    chat: "Chat",
    typeMessage: "Type your message...",

    patientInfo: "Patient Information",
    consultations: "Consultations",
    labResults: "Lab Results",
    prescriptions: "Prescriptions",
    vitalSigns: "Vital Signs",
    exportRecords: "Export Records",

    findMedicines: "Find Medicines",
    medicineAvailability: "Medicine Availability",
    nearbyPharmacies: "Nearby Pharmacies",
    available: "Available",
    limitedStock: "Limited Stock",
    notAvailable: "Not Available",
    reserveMedicine: "Reserve Medicine",

    analyzingSymptoms: "Analyzing your symptoms",
    assessmentResults: "Assessment Results",
    recommendedActions: "Recommended actions",
    bookConsultation: "Book consultation",
    trackSymptoms: "Track symptoms",
    newAssessment: "New assessment",
    emergencySituation: "Emergency situation",
    importantDisclaimer: "Important disclaimer",
    disclaimerText:
      "This AI assessment is for informational purposes only and should not replace professional medical advice. Always consult qualified healthcare providers for diagnosis and treatment.",
  },

  hi: {

    home: "मुख्य पृष्ठ",
    back: "वापस",
    next: "अगला",
    previous: "पिछला",
    submit: "सबमिट",
    cancel: "रद्द करें",
    loading: "लोड हो रहा है...",
    search: "खोजें",

    videoConsultation: "वीडियो परामर्श",
    healthRecords: "स्वास्थ्य रिकॉर्ड",
    medicineTracker: "दवा ट्रैकर",
    symptomChecker: "लक्षण जांच",
  navFeatures: "विशेषताएँ",
  navHowItWorks: "यह कैसे काम करता है",
  navForPatients: "मरीजों के लिए",
  navForDoctors: "डॉक्टरों के लिए",

    healthcareAtFingerTips: "आपकी उंगलियों पर स्वास्थ्य सेवा",
    healthcareDescription:
      "डॉक्टरों से जुड़ें, अपने स्वास्थ्य रिकॉर्ड प्रबंधित करें और नाभा के आसपास के 173 गांवों से देखभाल प्राप्त करें। गुणवत्तापूर्ण स्वास्थ्य सेवा अब सभी के लिए सुलभ।",
    villagesServed: "सेवित गाँव",
    doctorsAvailable: "उपलब्ध डॉक्टर",
    support24x7: "24/7 सहायता",
    startConsultation: "परामर्श शुरू करें",
    viewRecords: "रिकॉर्ड देखें",
    checkAvailability: "उपलब्धता जांचें",
    checkSymptoms: "लक्षण जांचें",
    availableLanguages: "हिन्दी, पंजाबी और अन्य भारतीय भाषाओं में उपलब्ध",
    worksOffline: "ऑफ़लाइन भी काम करता है",
    realTimeUpdates: "रियल-टाइम अपडेट",
    lowBandwidthOptimized: "कम बैंडविड्थ के लिए अनुकूलित",
    emergencyServices: "आपातकालीन सेवाएँ",
    emergencyDescription: "चिकित्सा आपातकाल के लिए, सीधे नाभा सिविल अस्पताल से संपर्क करें",
    callEmergency: "आपातकालीन कॉल: 108",
  heroSecureTagline: "ग्रामीण भारत के लिए सुरक्षित, कम-बैंडविड्थ टेलीहेल्थ",
  patientCta: "मरीज: अभी देखभाल पाएं",
  doctorCta: "डॉक्टर: प्रदाता के रूप में जुड़ें",
  videoPause: "रोकें",
  videoPlay: "चलाएँ",
  videoDemoLabel: "डेमो वीडियो",

    selectDoctor: "डॉक्टर चुनें",
    reasonForConsultation: "परामर्श का कारण",
    startVideoConsultation: "वीडियो परामर्श शुरू करें",
    connected: "कनेक्टेड",
    endConsultation: "परामर्श समाप्त करें",
    chat: "चैट",
    typeMessage: "अपना संदेश लिखें...",

    patientInfo: "मरीज़ की जानकारी",
    consultations: "परामर्श",
    labResults: "लैब परिणाम",
    prescriptions: "नुस्खे",
    vitalSigns: "महत्वपूर्ण संकेत",
    exportRecords: "रिकॉर्ड निर्यात करें",

    findMedicines: "दवाइयाँ खोजें",
    medicineAvailability: "दवा उपलब्धता",
    nearbyPharmacies: "नज़दीकी फार्मेसी",
    available: "उपलब्ध",
    limitedStock: "सीमित स्टॉक",
    notAvailable: "उपलब्ध नहीं",
    reserveMedicine: "दवा आरक्षित करें",

    analyzingSymptoms: "आपके लक्षणों का विश्लेषण",
    assessmentResults: "आकलन परिणाम",
    recommendedActions: "अनुशंसित कार्य",
    bookConsultation: "परामर्श बुक करें",
    trackSymptoms: "लक्षणों को ट्रैक करें",
    newAssessment: "नया मूल्यांकन",
    emergencySituation: "आपातकालीन स्थिति",
    importantDisclaimer: "महत्वपूर्ण अस्वीकरण",
    disclaimerText:
      "यह AI आकलन केवल सूचना के लिए है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है। उचित निदान और उपचार के लिए हमेशा योग्य स्वास्थ्य सेवा प्रदाताओं से परामर्श करें।",
  },

  pa: {

    home: "ਘਰ",
    back: "ਵਾਪਸ",
    next: "ਅਗਲਾ",
    previous: "ਪਿਛਲਾ",
    submit: "ਜਮ੍ਹਾਂ ਕਰੋ",
    cancel: "ਰੱਦ ਕਰੋ",
    loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...",
    search: "ਖੋਜੋ",

    videoConsultation: "ਵੀਡੀਓ ਸਲਾਹ",
    healthRecords: "ਸਿਹਤ ਰਿਕਾਰਡ",
    medicineTracker: "ਦਵਾਈ ਟਰੈਕਰ",
    symptomChecker: "ਲੱਛਣ ਜਾਂਚਕਰਤਾ",
  navFeatures: "ਫੀਚਰ",
  navHowItWorks: "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
  navForPatients: "ਮਰੀਜ਼ਾਂ ਲਈ",
  navForDoctors: "ਡਾਕਟਰਾਂ ਲਈ",

    healthcareAtFingerTips: "ਤੁਹਾਡੀਆਂ ਉਂਗਲਾਂ 'ਤੇ ਸਿਹਤ ਸੇਵਾ",
    healthcareDescription:
      "ਡਾਕਟਰਾਂ ਨਾਲ ਜੁੜੋ, ਆਪਣੇ ਸਿਹਤ ਰਿਕਾਰਡਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰੋ, ਅਤੇ ਨਾਭਾ ਦੇ ਆਲੇ-ਦੁਆਲੇ ਦੇ 173 ਪਿੰਡਾਂ ਤੋਂ ਮੈਡੀਕਲ ਦੇਖਭਾਲ ਪ੍ਰਾਪਤ ਕਰੋ। ਗੁਣਵੱਤਾ ਵਾਲੀ ਸਿਹਤ ਸੇਵਾ, ਹੁਣ ਸਭ ਲਈ ਪਹੁੰਚਯੋਗ।",
    villagesServed: "ਪਿੰਡਾਂ ਦੀ ਸੇਵਾ",
    doctorsAvailable: "ਉਪਲਬਧ ਡਾਕਟਰ",
    support24x7: "24/7 ਸਹਾਇਤਾ",
    startConsultation: "ਸਲਾਹ ਸ਼ੁਰੂ ਕਰੋ",
    viewRecords: "ਰਿਕਾਰਡ ਵੇਖੋ",
    checkAvailability: "ਉਪਲਬਧਤਾ ਜਾਂਚੋ",
    checkSymptoms: "ਲੱਛਣ ਜਾਂਚੋ",
    availableLanguages: "ਹਿੰਦੀ, ਪੰਜਾਬੀ ਅਤੇ ਹੋਰ ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਉਪਲਬਧ",
    worksOffline: "ਔਫਲਾਈਨ ਵੀ ਕੰਮ ਕਰਦਾ ਹੈ",
    realTimeUpdates: "ਰੀਅਲ-ਟਾਈਮ ਅਪਡੇਟ",
    lowBandwidthOptimized: "ਘੱਟ ਬੈਂਡਵਿਡਥ ਲਈ ਅਨੁਕੂਲਿਤ",
    emergencyServices: "ਐਮਰਜੈਂਸੀ ਸੇਵਾਵਾਂ",
    emergencyDescription: "ਮੈਡੀਕਲ ਐਮਰਜੈਂਸੀ ਲਈ, ਸਿੱਧੇ ਨਾਭਾ ਸਿਵਲ ਹਸਪਤਾਲ ਨਾਲ ਸੰਪਰਕ ਕਰੋ",
    callEmergency: "ਐਮਰਜੈਂਸੀ ਕਾਲ ਕਰੋ: 108",
  heroSecureTagline: "ਪਿੰਡਾਂ ਲਈ ਸੁਰੱਖਿਅਤ, ਘੱਟ ਬੈਂਡਵਿਡਥ ਟੈਲੀਹੈਲਥ",
  patientCta: "ਮਰੀਜ਼: ਹੁਣੇ ਦੇਖਭਾਲ ਲਵੋ",
  doctorCta: "ਡਾਕਟਰ: ਸੇਵਾ ਪ੍ਰਦਾਤਾ ਵਜੋਂ ਜੁੜੋ",
  videoPause: "ਰੋਕੋ",
  videoPlay: "ਚਲਾਓ",
  videoDemoLabel: "ਡੇਮੋ ਵੀਡੀਓ",

    selectDoctor: "ਡਾਕਟਰ ਚੁਣੋ",
    reasonForConsultation: "ਸਲਾਹ ਦਾ ਕਾਰਨ",
    startVideoConsultation: "ਵੀਡੀਓ ਸਲਾਹ ਸ਼ੁਰੂ ਕਰੋ",
    connected: "ਜੁੜਿਆ ਹੋਇਆ",
    endConsultation: "ਸਲਾਹ ਖਤਮ ਕਰੋ",
    chat: "ਚੈਟ",
    typeMessage: "ਆਪਣਾ ਸੰਦੇਸ਼ ਟਾਈਪ ਕਰੋ...",

    patientInfo: "ਮਰੀਜ਼ ਦੀ ਜਾਣਕਾਰੀ",
    consultations: "ਸਲਾਹ-ਮਸ਼ਵਰੇ",
    labResults: "ਲੈਬ ਨਤੀਜੇ",
    prescriptions: "ਨੁਸਖੇ",
    vitalSigns: "ਮਹੱਤਵਪੂਰਨ ਸੰਕੇਤ",
    exportRecords: "ਰਿਕਾਰਡ ਨਿਰਯਾਤ ਕਰੋ",

    findMedicines: "ਦਵਾਈਆਂ ਲੱਭੋ",
    medicineAvailability: "ਦਵਾਈ ਦੀ ਉਪਲਬਧਤਾ",
    nearbyPharmacies: "ਨੇੜਲੀਆਂ ਫਾਰਮੇਸੀਆਂ",
    available: "ਉਪਲਬਧ",
    limitedStock: "ਸੀਮਤ ਸਟਾਕ",
    notAvailable: "ਉਪਲਬਧ ਨਹੀਂ",
    reserveMedicine: "ਦਵਾਈ ਰਿਜ਼ਰਵ ਕਰੋ",

    analyzingSymptoms: "ਤੁਹਾਡੇ ਲੱਛਣਾਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ",
    assessmentResults: "ਮੁਲਾਂਕਣ ਨਤੀਜੇ",
    recommendedActions: "ਸਿਫਾਰਸ਼ੀ ਕਾਰਵਾਈਆਂ",
    bookConsultation: "ਸਲਾਹ ਬੁੱਕ ਕਰੋ",
    trackSymptoms: "ਲੱਛਣਾਂ ਨੂੰ ਟਰੈਕ ਕਰੋ",
    newAssessment: "ਨਵਾਂ ਮੁਲਾਂਕਣ",
    emergencySituation: "ਐਮਰਜੈਂਸੀ ਸਥਿਤੀ",
    importantDisclaimer: "ਮਹੱਤਵਪੂਰਨ ਬੇਦਾਅਵਾ",
    disclaimerText:
      "ਇਹ AI ਮੁਲਾਂਕਣ ਸਿਰਫ਼ ਜਾਣਕਾਰੀ ਦੇ ਉਦੇਸ਼ਾਂ ਲਈ ਹੈ ਅਤੇ ਪੇਸ਼ੇਵਰ ਮੈਡੀਕਲ ਸਲਾਹ ਦਾ ਬਦਲ ਨਹੀਂ ਹੋਣਾ ਚਾਹੀਦਾ। ਸਹੀ ਨਿਦਾਨ ਅਤੇ ਇਲਾਜ ਲਈ ਹਮੇਸ਼ਾ ਯੋਗ ਸਿਹਤ ਸੇਵਾ ਪ੍ਰਦਾਤਾਵਾਂ ਨਾਲ ਸਲਾਹ ਕਰੋ।",
  },

  bn: { availableLanguages: "বাংলা সহ একাধিক ভারতীয় ভাষায় উপলব্ধ" },
  te: { availableLanguages: "హిందీ, పంజాబీ తో పాటు అనేక భారతీయ భాషల్లో అందుబాటులో" },
  ta: { availableLanguages: "இந்தி, பஞ்சாபியுடன் பல இந்திய மொழிகளில் கிடைக்கிறது" },
  ml: { availableLanguages: "ഹിന്ദിയും പഞ്ചാബിയും ഉള്‍പ്പെടെ നിരവധി ഇന്ത്യന്‍ ഭാഷകളില്‍ ലഭ്യം" },
  kn: { availableLanguages: "ಹಿಂದಿ, ಪಂಜಾಬಿ ಸೇರಿದಂತೆ ಅನೇಕ ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ಲಭ್ಯ" },
  gu: { availableLanguages: "હિન્દી, પંજાબી સહિત ઘણી ભારતીય ભાષામાં ઉપલબ્ધ" },
  mr: { availableLanguages: "हिंदी, पंजाबी सह अनेक भारतीय भाषांमध्ये उपलब्ध" },
  or: { availableLanguages: "ହିନ୍ଦୀ, ପଞ୍ଜାବୀ ସହିତ ଅନେକ ଭାରତୀୟ ଭାଷାରେ ଉପଲବ୍ଧ" },
  as: { availableLanguages: "হিন্দী, পাঞ্জাবীৰ উপৰি বহুত ভারতীয় ভাষাত উপলব্ধ" },
  ur: { availableLanguages: "ہندی، پنجابی سمیت متعدد بھارتی زبانوں میں دستیاب" },
}

export const supportedLanguages: Array<{ code: Language; name: string; nativeName: string }> = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिंदी" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
]

export function getMergedTranslations(language: Language): Translations {
  const base = (translations.en || {}) as Translations
  const partial = (translations[language] || {}) as Partial<Translations>
  return { ...base, ...partial }
}

export function useTranslation(language: Language = "en"): Translations {
  return getMergedTranslations(language)
}
