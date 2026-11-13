export type HospitalServiceAliases = {
  officialName: string;
  commonServices: string[];
  englishSynonyms: string[];
  kannadaSynonyms: string[];
  hindiSynonyms?: string[];
  malayalamSynonyms?: string[];
  spellingVariations: string[];
};

export const hospitalServiceAliases: Record<string, HospitalServiceAliases> = {
  "General Medicine": {
    officialName: "General Medicine",
    commonServices: ["general consultation", "medical consultation"],
    englishSynonyms: ["general physician", "doctor consultation", "physician"],
    kannadaSynonyms: ["ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ", "ವೈದ್ಯರನ್ನು ಭೇಟಿ", "ವೈದ್ಯರ ಸಲಹೆ", "ಸಾಮಾನ್ಯ ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗಬೇಕು"],
    hindiSynonyms: ["सामान्य चिकित्सा", "डॉक्टर से परामर्श", "सामान्य चिकित्सक"],
    malayalamSynonyms: ["ജനറൽ മെഡിസിൻ", "ഡോക്ടറെ കാണണം", "ഡോക്ടർ കൺസൾട്ടേഷൻ"],
    spellingVariations: [],
  },
  Laboratory: {
    officialName: "Laboratory",
    commonServices: ["blood test", "laboratory test", "blood examination"],
    englishSynonyms: ["lab", "blood work", "test my blood", "blood check"],
    kannadaSynonyms: [
      "ರಕ್ತ ಪರೀಕ್ಷೆ",
      "ರಕ್ತ ತಪಾಸಣೆ",
      "ಪ್ರಯೋಗಾಲಯ",
      "ಲ್ಯಾಬ್",
      "ರಕ್ತ ಪರೀಕ್ಷೆ ಮಾಡಿಸಬೇಕು",
      "ರಕ್ತ ತಪಾಸಣೆ ಮಾಡಿಸಬೇಕು",
    ],
    hindiSynonyms: ["खून की जांच", "रक्त परीक्षण", "लैब टेस्ट", "मुझे खून की जांच करवानी है"],
    malayalamSynonyms: ["രക്തപരിശോധന", "ലാബ് ടെസ്റ്റ്", "എനിക്ക് രക്തപരിശോധന ചെയ്യണം"],
    spellingVariations: ["laboratry", "lab test"],
  },
  Radiology: {
    officialName: "Radiology",
    commonServices: ["x-ray", "chest x-ray", "medical imaging"],
    englishSynonyms: ["x ray", "xray", "imaging", "radiology scan"],
    kannadaSynonyms: [
      "ಎಕ್ಸ್ ರೇ",
      "ಎಕ್ಸ್-ರೇ",
      "ಎಕ್ಸ್‌ರೇ",
      "ಎಕ್ಸರೇ",
      "ಸ್ಕ್ಯಾನ್",
      "ರೇಡಿಯಾಲಜಿ",
      "ವಿಕಿರಣಶಾಸ್ತ್ರ ವಿಭಾಗ",
      "ಎಕ್ಸ್ ರೇ ಮಾಡಿಸಬೇಕು",
    ],
    hindiSynonyms: ["एक्स रे", "एक्स-रे", "एक्सरे", "मेडिकल इमेजिंग", "मुझे एक्स-रे करवाना है"],
    malayalamSynonyms: ["എക്സ് റേ", "എക്സ്-റേ", "എക്സ്റേ", "മെഡിക്കൽ ഇമേജിംഗ്", "എനിക്ക് എക്സ്-റേ ചെയ്യണം"],
    spellingVariations: ["xray", "x-ray", "x ray"],
  },
  Cardiology: {
    officialName: "Cardiology",
    commonServices: ["heart specialist", "heart doctor", "cardiology consultation"],
    englishSynonyms: ["cardiologist", "heart consultation"],
    kannadaSynonyms: [
      "ಹೃದಯ ತಜ್ಞ",
      "ಹೃದಯ ತಜ್ಞರನ್ನು",
      "ಹೃದಯ ವೈದ್ಯ",
      "ಹೃದ್ರೋಗ ತಜ್ಞ",
      "ಕಾರ್ಡಿಯಾಲಜಿ",
      "ಹೃದ್ರೋಗ ವಿಭಾಗ",
      "ಹೃದಯ ತಜ್ಞರನ್ನು ಭೇಟಿಯಾಗಬೇಕು",
    ],
    hindiSynonyms: ["हृदय विशेषज्ञ", "हृदय रोग विशेषज्ञ", "कार्डियोलॉजिस्ट", "मुझे हृदय विशेषज्ञ से मिलना है"],
    malayalamSynonyms: ["ഹൃദയ വിദഗ്ധൻ", "കാർഡിയോളജിസ്റ്റ്", "ഹൃദ്രോഗ വിദഗ്ധനെ കാണണം"],
    spellingVariations: ["cardiolgist", "cardiolgy"],
  },
  Neurology: {
    officialName: "Neurology",
    commonServices: ["brain specialist", "neurology consultation"],
    englishSynonyms: ["neurologist", "nerve specialist"],
    kannadaSynonyms: ["ನರವಿಜ್ಞಾನ", "ನರರೋಗ", "ನರವೈದ್ಯ", "ನ್ಯೂರಾಲಜಿ", "ನರರೋಗ ವಿಭಾಗ"],
    hindiSynonyms: ["न्यूरोलॉजी", "नसों के विशेषज्ञ", "मस्तिष्क विशेषज्ञ"],
    malayalamSynonyms: ["ന്യൂറോളജി", "നാഡീ വിദഗ്ധൻ", "മസ്തിഷ്ക വിദഗ്ധൻ"],
    spellingVariations: ["neurolgy", "neurologst"],
  },
  Emergency: {
    officialName: "Emergency",
    commonServices: ["emergency room", "urgent care"],
    englishSynonyms: ["emergency department"],
    kannadaSynonyms: ["ತುರ್ತು", "ತುರ್ತು ವಿಭಾಗ", "ತುರ್ತು ಚಿಕಿತ್ಸೆ", "ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗ"],
    hindiSynonyms: ["आपातकाल", "इमरजेंसी विभाग", "तत्काल चिकित्सा"],
    malayalamSynonyms: ["അടിയന്തര വിഭാഗം", "എമർജൻസി", "അടിയന്തര ചികിത്സ"],
    spellingVariations: [],
  },
  Pharmacy: {
    officialName: "Pharmacy",
    commonServices: ["medicine pickup", "prescription collection"],
    englishSynonyms: ["medicine", "medication", "drug store"],
    kannadaSynonyms: ["ಔಷಧಿ", "ಔಷಧಾಲಯ", "ಔಷಧಿ ಪಡೆಯಬೇಕು"],
    hindiSynonyms: ["दवा", "फार्मेसी", "दवा लेनी है"],
    malayalamSynonyms: ["മരുന്ന്", "ഫാർമസി", "മരുന്ന് എടുക്കണം"],
    spellingVariations: ["pharmcy", "pharamcy"],
  },
  "Billing Counter": {
    officialName: "Billing Counter",
    commonServices: ["bill payment", "payment counter"],
    englishSynonyms: ["billing", "pay bill"],
    kannadaSynonyms: ["ಬಿಲ್ಲಿಂಗ್", "ಬಿಲ್ಲಿಂಗ್ ವಿಭಾಗ", "ಬಿಲ್ ಪಾವತಿ", "ಹಣ ಪಾವತಿ", "ಬಿಲ್ ಕಟ್ಟಬೇಕು"],
    spellingVariations: ["biling counter", "billng"],
  },
  Orthopaedics: {
    officialName: "Orthopaedics",
    commonServices: ["bone specialist", "joint doctor"],
    englishSynonyms: ["orthopedics", "bone doctor"],
    kannadaSynonyms: ["ಮೂಳೆ", "ಮೂಳೆ ವೈದ್ಯ", "ಆರ್ಥೋಪೆಡಿಕ್ಸ್"],
    spellingVariations: ["orthopedics", "orthopaedic"],
  },
  Cafeteria: {
    officialName: "Cafeteria",
    commonServices: ["canteen", "food"],
    englishSynonyms: ["cafe", "place to eat"],
    kannadaSynonyms: ["ಊಟ", "ಆಹಾರ", "ಕ್ಯಾಂಟೀನ್"],
    spellingVariations: ["cafateria", "cafeteriya"],
  },
};
