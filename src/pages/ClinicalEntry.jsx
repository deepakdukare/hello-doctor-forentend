import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Printer, Lock, Paperclip, Plus, X, FileText, RefreshCw, Activity, User, Calendar, Shield, ArrowRight, Clock, Eye, MessageCircle, Clipboard, Zap, Stethoscope, AlertTriangle, Trash2, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Heart, Sparkles, Pill, FileCheck, Check, BookmarkPlus } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';
import {
    getComprehensiveProfile,
    addMRDEntry,
    exportMRD,
    getPatients,
    getDoctors,
    getEntryByAppointment,
    toIsoDate,
    getAppointments,
    getPatientById,
    lookupAppointments,
    getMRDEntryPdfUrl,
    getMRDByPatientId,
    getClinicalIcd10,
    getClinicalMedicines,
    getClinicalInvestigations,
    getClinicalProcedures,
    getClinicalComplaints,
    getClinicalAllergies,
    getClinicalDiagramTemplates,
    getReferralTargets,
    getClinicalNoteTemplates,
    getCareAdviceTemplates,
    upsertClinicalTemplate,
    getTemplates,
    getMasterData
} from '../api/index';

const EMPTY_ALLERGY = { category: 'Drug', type: '', reaction: '', intensity: '', duration: '', informed_by: '' };

const EMPTY_PRESCRIPTION_DRAFT = {
    type: 'Brand',
    medicine: '',
    dosage_form: 'Tablet',
    indication: '',
    schedule: '',
    route: 'ORAL',
    days: '',
    quantity: '',
    refills: '0',
    instruction: '',
    special_instructions: '',
    pharmacist_notes: 'Substitute allowed'
};

const EMPTY_INVESTIGATION_DRAFT = {
    name: '',
    priority: 'Routine',
    timeframe: 'Routine',
    indication: '',
    notes: ''
};

const EMPTY_PROCEDURE_DRAFT = {
    name: '',
    procedure_type: 'Therapeutic',
    location: 'In clinic'
};

const EMPTY_DIAGNOSIS_DRAFT = {
    diagnosis_name: '',
    icd_10: '',
    stage: 'Provisional',
    type: 'Primary',
    severity: 'Mild',
    comorbidity: '',
    notes: ''
};

const QUICK_CLINICAL_TEMPLATES = {
    bronchiolitis: {
        name: 'Acute Bronchiolitis',
        icon: '🫁',
        badge: 'Infant / Pediatric',
        complaints: ['Cough', 'Wheezing / Rapid breathing', 'Low-grade fever', 'Decreased oral intake'],
        hpi: 'Infant/child presents with 3-day history of clear rhinorrhea followed by persistent cough, wheezing, and increased work of breathing. Mild tachypnea noted. Feeding somewhat reduced, hydrated, passing urine normally.',
        exam: {
            pe_pallor: 'Absent',
            pe_cyanosis: 'Absent',
            physical_examination: 'Active child, mild intercostal retractions. Chest: Bilateral expiratory wheezes and coarse crackles. No grunting, no stridor.',
            systemic_examination: 'CVS: S1 S2 heard, no murmurs. P/A: Soft, non-tender. CNS: Alert, responsive.'
        },
        diagnoses: [
            { diagnosis_name: 'Acute bronchiolitis', icd_10: 'J21.9', stage: 'Confirmed', type: 'Primary', severity: 'Moderate' }
        ],
        investigations: [
            { name: 'Pulse Oximetry continuous monitoring', priority: 'Stat', timeframe: 'Immediate' },
            { name: 'Chest X-Ray AP/PA (if deteriorating)', priority: 'Routine', timeframe: 'Within 24h' }
        ],
        prescriptions: [
            { medicine: 'Saline 0.9% Nasal Drops', dosage_form: 'Drops', indication: 'Nasal clearance', schedule: '2 drops in each nostril TID before feeds', route: 'NASAL', days: 5, quantity: '1 bottle', instruction: 'Instill 5 mins before feeds' },
            { medicine: 'Syrup Paracetamol (120mg/5ml)', dosage_form: 'Syrup', indication: 'Fever / Discomfort', schedule: 'As per weight (15mg/kg) SOS Q6H', route: 'ORAL', days: 3, quantity: '1 bottle', instruction: 'Give only if temperature > 100°F' }
        ],
        advice_home_care: 'Frequent small feeds. Humidified air/mist. Keep head end slightly elevated. Saline suctioning of anterior nares before feeding and sleeping.',
        advice_warning_signs: 'Bring immediately if: severe chest in-drawing, grunting, bluish lips/nails, inability to feed, or extreme lethargy.',
        next_visit_due: '2 days'
    },
    urti: {
        name: 'Viral Fever / URTI',
        icon: '🌡️',
        badge: 'Common / All Ages',
        complaints: ['Fever', 'Running nose', 'Throat irritation / Cough', 'Body aches'],
        hpi: 'Acute onset of high/moderate grade fever for 2 days associated with clear rhinorrhea, sneezing, and dry throat. No ear ache, no rash, no dyspnea.',
        exam: {
            pe_pallor: 'Absent',
            physical_examination: 'Pharynx: Mild erythema, no tonsillar exudates. B/L Tympanic membranes normal pearly grey. Chest: Clear b/l, no added sounds.',
            systemic_examination: 'Abdomen soft, non-tender. Neurologically alert.'
        },
        diagnoses: [
            { diagnosis_name: 'Acute Upper Respiratory Tract Infection (URTI)', icd_10: 'J06.9', stage: 'Provisional', type: 'Primary', severity: 'Mild' }
        ],
        investigations: [
            { name: 'Complete Blood Count (CBC) (if fever > 4 days)', priority: 'Routine', timeframe: 'Routine' }
        ],
        prescriptions: [
            { medicine: 'Syrup / Tab Paracetamol', dosage_form: 'Syrup', indication: 'Antipyretic', schedule: '10-15 mg/kg Q6H SOS', route: 'ORAL', days: 3, quantity: '1 bottle', instruction: 'With or after food. Keep hydrated.' },
            { medicine: 'Cetirizine Syrup / Tablet', dosage_form: 'Syrup', indication: 'Rhinorrhea / Sneezing', schedule: 'Once daily at bedtime', route: 'ORAL', days: 5, quantity: '1 strip/bottle', instruction: 'Night time dose' }
        ],
        advice_home_care: 'Warm fluids, honey for cough (if >1 yr old), steam inhalation, adequate rest and plenty of oral fluids.',
        advice_warning_signs: 'Red flags: Fever > 102°F persisting beyond 3 days, breathlessness, rash, ear discharge, persistent vomiting.',
        next_visit_due: '3 days'
    },
    gastroenteritis: {
        name: 'Acute Gastroenteritis',
        icon: '💧',
        badge: 'Pediatric / Adult',
        complaints: ['Watery diarrhea', 'Vomiting', 'Abdominal cramps', 'Mild fever'],
        hpi: 'Patient developed watery, non-bloody loose stools (4-6 episodes/day) with 2 episodes of vomiting since yesterday. Thirsty, drinking fluids eagerly. Last urine passed 3 hours ago.',
        exam: {
            pe_oedema: 'Absent',
            physical_examination: 'Tongue moist, skin turgor normal, eyes not sunken. No severe dehydration signs. Abdomen: Mild generalized tenderness, hyperactive bowel sounds.',
            systemic_examination: 'No organomegaly, soft abdomen.'
        },
        diagnoses: [
            { diagnosis_name: 'Acute gastroenteritis without severe dehydration', icd_10: 'A09', stage: 'Confirmed', type: 'Primary', severity: 'Mild' }
        ],
        investigations: [
            { name: 'Stool Routine & Microscopy (if persistent or bloody)', priority: 'Routine', timeframe: 'Routine' },
            { name: 'Serum Electrolytes (if dehydration signs)', priority: 'Routine', timeframe: 'Routine' }
        ],
        prescriptions: [
            { medicine: 'Oral Rehydration Solution (ORS - WHO formula)', dosage_form: 'Powder', indication: 'Rehydration', schedule: '1 sachet in 1 Litre boiled & cooled water. Sip after every loose stool', route: 'ORAL', days: 3, quantity: '5 sachets', instruction: 'Discard after 24 hours of preparation' },
            { medicine: 'Zinc Gluconate (20mg/day)', dosage_form: 'Syrup', indication: 'Mucosal recovery', schedule: '10mg/day (<6mo) or 20mg/day (>6mo) once daily', route: 'ORAL', days: 14, quantity: '1 bottle', instruction: 'Continue full 14 days course' },
            { medicine: 'Syrup Ondansetron (if vomiting)', dosage_form: 'Syrup', indication: 'Antiemetic', schedule: '0.15 mg/kg SOS before feeds', route: 'ORAL', days: 2, quantity: '1 bottle', instruction: 'Give 15 min before oral rehydration' }
        ],
        advice_home_care: 'Continue normal feeding (breastfeeding/curd, rice porridge, banana). Avoid concentrated sugary juices or sodas.',
        advice_warning_signs: 'Red flags: Inability to drink or retain fluids, blood in stool, lethargy/floppiness, sunken eyes, no urine for >6 hours.',
        next_visit_due: '2 days'
    },
    asthma: {
        name: 'Asthma / Reactive Airway',
        icon: '💨',
        badge: 'Pediatric / Adult',
        complaints: ['Sudden onset wheezing', 'Shortness of breath', 'Dry nocturnal cough', 'Chest tightness'],
        hpi: 'Known or suspected reactive airway disease presenting with acute onset wheezing and dry cough following weather change/dust exposure. Relieved partially by bronchodilator.',
        exam: {
            physical_examination: 'Tachypneic, able to speak full sentences. Chest: Diffuse bilateral polyphonic expiratory wheezing with prolonged expiratory phase. SpO2 maintained.',
            systemic_examination: 'Cardiovascular: Normal heart sounds, no gallop.'
        },
        diagnoses: [
            { diagnosis_name: 'Acute asthma exacerbation (Mild-Moderate)', icd_10: 'J45.901', stage: 'Confirmed', type: 'Primary', severity: 'Moderate' }
        ],
        investigations: [
            { name: 'Peak Expiratory Flow Rate (PEFR)', priority: 'Stat', timeframe: 'Immediate' },
            { name: 'SpO2 Monitoring', priority: 'Stat', timeframe: 'Immediate' }
        ],
        prescriptions: [
            { medicine: 'Salbutamol MDI with Spacer (100mcg/puff)', dosage_form: 'Inhaler', indication: 'Bronchodilation', schedule: '2-4 puffs Q4-6H via spacer', route: 'INHALATION', days: 5, quantity: '1 inhaler', instruction: 'Rinse mouth after use' },
            { medicine: 'Budesonide Respules / Inhaler', dosage_form: 'Inhaler', indication: 'Anti-inflammatory', schedule: '200mcg BID via spacer/nebulizer', route: 'INHALATION', days: 14, quantity: '1 inhaler', instruction: 'Controller medication' }
        ],
        advice_home_care: 'Strict allergen/dust avoidance. Avoid sudden cold beverages. Always use spacer device with inhaler.',
        advice_warning_signs: 'Red flags: Inability to speak, cyanosis, wheeze not improving after 3 bronchodilator cycles, SpO2 < 93%. Go to ER immediately.',
        next_visit_due: '3 days'
    },
    well_baby: {
        name: 'Well Baby / Vaccination',
        icon: '👶',
        badge: 'Infant / Pediatric',
        complaints: ['Routine growth assessment', 'Scheduled immunizations', 'Feeding guidance'],
        hpi: 'Healthy child brought for scheduled well-child visit and immunization per national/IAP schedule. Feeding well, attaining milestones on time, no parental concerns.',
        exam: {
            physical_examination: 'Well-nourished, active, alert infant. Tone and reflexes normal. Anterior fontanelle flat and soft. Head-to-toe check unremarkable.',
            systemic_examination: 'Chest: Clear. CVS: S1 S2 normal. Abdomen: Soft, no organomegaly.'
        },
        diagnoses: [
            { diagnosis_name: 'Encounter for routine child health examination & vaccination', icd_10: 'Z00.129', stage: 'Confirmed', type: 'Primary', severity: 'Mild' }
        ],
        investigations: [],
        prescriptions: [
            { medicine: 'Syrup Paracetamol (120mg/5ml)', dosage_form: 'Syrup', indication: 'Post-vaccine fever/pain', schedule: '10-15 mg/kg SOS after vaccine if irritable/febrile', route: 'ORAL', days: 2, quantity: '1 bottle', instruction: 'Use only if irritable or temp > 100°F' }
        ],
        advice_home_care: 'Cold compress at injection site if redness/swelling occurs. Maintain regular feeding schedule.',
        advice_warning_signs: 'Return if persistent crying > 3 hours, high fever > 103°F, or unusual swelling at injection site.',
        next_visit_due: '1 month'
    },
    otitis_media: {
        name: 'Acute Otitis Media',
        icon: '👂',
        badge: 'Pediatric / ENT',
        complaints: ['Ear pain (Otalgia)', 'Fever', 'Irritability / Tugging at ear', 'Preceding cold'],
        hpi: 'Child developed acute severe ear pain and fever following an upper respiratory infection 4 days ago. Restless, pulling at right ear, disrupted sleep.',
        exam: {
            physical_examination: 'Otoscopy: Right tympanic membrane erythematous, bulging with decreased mobility. Left TM normal. Mastoid non-tender.',
            systemic_examination: 'Pharynx mildly congested. Systemic exam unremarkable.'
        },
        diagnoses: [
            { diagnosis_name: 'Acute suppurative otitis media', icd_10: 'H66.00', stage: 'Confirmed', type: 'Primary', severity: 'Moderate' }
        ],
        investigations: [],
        prescriptions: [
            { medicine: 'Syrup Amoxicillin-Clavulanate (228mg/5ml)', dosage_form: 'Syrup', indication: 'Bacterial otitis media', schedule: '45-90 mg/kg/day divided BID', route: 'ORAL', days: 7, quantity: '1 bottle', instruction: 'Complete full 7-day course. Take after food.' },
            { medicine: 'Syrup Ibuprofen / Paracetamol', dosage_form: 'Syrup', indication: 'Analgesic / Antipyretic', schedule: '10 mg/kg Q8H for pain relief', route: 'ORAL', days: 3, quantity: '1 bottle', instruction: 'For ear pain' }
        ],
        advice_home_care: 'Keep ear dry. Do not insert cotton buds or oil into ear canal.',
        advice_warning_signs: 'Red flags: Ear discharge/pus, swelling behind ear, facial weakness, persistent fever > 48h on antibiotics.',
        next_visit_due: '5 days'
    }
};

const QUICK_COMPLAINT_CHIPS = [
    'Fever', 'Cough', 'Cold / Runny nose', 'Vomiting', 'Loose stools',
    'Wheezing / Breathlessness', 'Abdominal pain', 'Ear pain', 'Skin rash / Itch',
    'Poor feeding / Appetite loss', 'Headache', 'Sore throat', 'Routine Checkup / Vaccine'
];

const QUICK_INVESTIGATION_CHIPS = [
    'Complete Blood Count (CBC)', 'CRP (C-Reactive Protein)', 'Serum Electrolytes',
    'Urine Routine & Microscopy', 'Chest X-Ray (AP/PA)', 'Stool Routine & Microscopy',
    'Blood Culture & Sensitivity', 'Rapid Dengue NS1 / IgM', 'Thyroid Profile (TSH)',
    'Liver Function Test (LFT)', 'Renal Function Test (KFT)'
];

const QUICK_PROCEDURE_CHIPS = [
    'Nebulization (Salbutamol/Budecort)', 'Wound Dressing / Cleansing',
    'Suture Removal', 'IV Cannulation', 'IM Injection Administration',
    'Ear Canal Suctioning', 'Foreign Body Removal'
];

const QUICK_ADVICE_CHIPS = {
    homeCare: [
        'Plenty of oral fluids & rest',
        'Frequent small feeds on demand',
        'Steam inhalation & warm saline gargles',
        'Keep head end elevated during sleep',
        'Tepid sponging if temperature > 101°F'
    ],
    diet: [
        'Soft, light home cooked diet (Khichdi, curd rice)',
        'Fresh fruits, tender coconut water, soup',
        'Avoid oily, spicy, cold and junk foods',
        'ORS after every loose stool',
        'Exclusive breastfeeding on demand'
    ],
    warningSigns: [
        'Fever > 102°F persisting beyond 3 days',
        'Fast breathing, chest in-drawing or grunting',
        'Inability to drink or retain fluids / persistent vomiting',
        'Excessive sleepiness, lethargy or seizures',
        'Blood in stools or severe abdominal pain'
    ]
};

const EMPTY_ENTRY = {
    patient_id: '', appointment_id: '', visit_date: toIsoDate(),
    visit_type: 'CONSULTATION', attending_doctor: 'Dr. Deepak',
    chief_complaint: '', clinical_notes: '', diagnosis: '',
    prescription: '', investigations: '', next_visit_due: '', recorded_by: 'Dr. Deepak',
    weight: '', height: '', bmi: '', temperature: '', spo2: '', pulse: '',
    bp: '', respiration: '', random_sugar: '', head_circumference: '',
    pain_score: '', fall_risk: '', interpreter: '',
    symptoms: '', advice: '', attachments: [], allergies: [], no_known_allergy: false,
    chief_complaints_list: [], history_of_present_illness: '',
    past_history: '', personal_history: '', family_history: '', family_diseases: [],
    pe_pallor: '', pe_icterus: '', pe_oedema: '', pe_lymphadenopathy: '', pe_cyanosis: '', pe_clubbing: '',
    physical_examination: '', systemic_examination: '', diagram_image: '',
    medication_history: [], prescriptions_list: [], other_medication: '', admission_status: 'Not-Required',
    followup_advice: '', referrals_list: [],
    intent_of_treatment: '', refer_to_tumor_board: 'No', nutrition_advice: 'No', psychology_advice: 'No',
    physiotherapy_advice: 'No', complex_care: 'No', additional_remarks: '',
    visit_tags: [],
    advice_home_care: '',
    advice_diet: '',
    advice_warning_signs: '',
    dietary_plan: '',
    activity_restrictions: '',
    home_monitoring: '',
    school_work_note: '',
    storage_instructions: '',
    side_effects_warning: '',
    pregnancy_lactation_status: '',
    age_group: '',
    neonatal_history: {
        birth_weight: '',
        gestational_age: '',
        apgar_1min: '',
        apgar_5min: '',
        delivery_type: '',
        nicu_stay: 'No',
        feeding_type: 'Exclusive Breastfeeding',
        anterior_fontanelle: 'Normal/Flat'
    },
    pediatric_assessment: {
        milestones: 'Age-Appropriate',
        immunization_status: 'Up to Date (IAP)',
        school_activity: 'Active & Normal',
        screening_notes: ''
    },
    adolescent_assessment: {
        headsss_risk: 'Low Risk',
        pubertal_growth: 'Normal for Age',
        screen_wellness: 'Moderate (<2h screen, normal sleep)'
    },
    adult_assessment: {
        tobacco_use: 'Non-Smoker',
        alcohol_intake: 'None / Social',
        physical_activity: 'Moderate',
        cardiovascular_risk: 'Low Risk'
    },
    geriatric_assessment: {
        cognitive_status: 'Intact',
        mobility_adl: 'Independent',
        polypharmacy_alert: 'Reviewed',
        nutrition_dentition: 'Normal'
    },
    structured_family_history: [],
    consents: [
        { consent_type: 'Treatment Consent', is_accepted: false, witness_name: '' },
        { consent_type: 'Vaccination Consent', is_accepted: false, witness_name: '' },
        { consent_type: 'Data Usage Consent', is_accepted: false, witness_name: '' }
    ]
};

const parseDateSafe = (raw) => {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
    if (typeof raw === 'number') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }
    const str = String(raw).trim();
    // Support DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

const computeNextVisitDueDate = (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str || str.toLowerCase() === 'invalid date') return null;

    const relMatch = str.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
    if (relMatch) {
        const count = parseInt(relMatch[1], 10);
        const unit = relMatch[2].toLowerCase();
        const target = new Date();
        if (unit.startsWith('day')) {
            target.setDate(target.getDate() + count);
        } else if (unit.startsWith('week')) {
            target.setDate(target.getDate() + count * 7);
        } else if (unit.startsWith('month')) {
            target.setMonth(target.getMonth() + count);
        }
        return toIsoDate(target);
    }

    const d = parseDateSafe(str);
    return d ? toIsoDate(d) : null;
};

const getAgeDetails = (patientOrInput) => {
    if (!patientOrInput) return { years: null, months: null, days: null, totalDays: null, display: '' };

    let dob = null;
    let explicitAge = null;
    let ageYears = null;
    let ageMonths = null;
    let ageDays = null;

    if (typeof patientOrInput === 'object' && !(patientOrInput instanceof Date)) {
        dob = patientOrInput.dob || patientOrInput.date_of_birth || patientOrInput.birth_date;
        explicitAge = patientOrInput.age ?? patientOrInput.patient_age;
        ageYears = patientOrInput.age_years;
        ageMonths = patientOrInput.age_months;
        ageDays = patientOrInput.age_days;
    } else {
        if (typeof patientOrInput === 'number' || (!isNaN(patientOrInput) && !String(patientOrInput).includes('-') && !String(patientOrInput).includes('/'))) {
            explicitAge = Number(patientOrInput);
        } else {
            dob = patientOrInput;
        }
    }

    // 1. If valid DOB
    const parsedDob = parseDateSafe(dob);
    if (parsedDob) {
        const now = new Date();
        const diffMs = now.getTime() - parsedDob.getTime();
        const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let years = now.getFullYear() - parsedDob.getFullYear();
        let months = now.getMonth() - parsedDob.getMonth();
        let days = now.getDate() - parsedDob.getDate();
        if (days < 0) {
            months -= 1;
            const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
            days += prevMonthLastDay;
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }
        if (years < 0) years = 0;

        let display = '';
        if (years > 0) {
            display = `${years}y` + (months > 0 ? ` ${months}m` : '');
        } else if (months > 0) {
            display = `${months}m` + (days > 0 ? ` ${days}d` : '');
        } else {
            display = `${Math.max(0, totalDays)}d`;
        }

        return { years: totalDays / 365.25, months: totalDays / 30.4375, days: totalDays, totalDays, display, dob: parsedDob };
    }

    // 2. If structured age_years / age_months / age_days
    if (ageYears != null || ageMonths != null || ageDays != null) {
        const y = Number(ageYears || 0);
        const m = Number(ageMonths || 0);
        const d = Number(ageDays || 0);
        const totalDays = Math.round(y * 365.25 + m * 30.4375 + d);
        const parts = [];
        if (y > 0) parts.push(`${y}y`);
        if (m > 0) parts.push(`${m}m`);
        if (d > 0 || !parts.length) parts.push(`${d}d`);
        return { years: totalDays / 365.25, months: totalDays / 30.4375, days: totalDays, totalDays, display: parts.join(' ') };
    }

    // 3. If explicit age string or number e.g. "5", "10 months", "15 days", "70"
    if (explicitAge != null && explicitAge !== '') {
        const str = String(explicitAge).trim().toLowerCase();

        const dMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:d|day|days)/);
        if (dMatch) {
            const days = parseFloat(dMatch[1]);
            return { years: days / 365.25, months: days / 30.4375, days, totalDays: days, display: `${days}d` };
        }

        const wMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:w|wk|wks|week|weeks)/);
        if (wMatch) {
            const days = parseFloat(wMatch[1]) * 7;
            return { years: days / 365.25, months: days / 30.4375, days, totalDays: days, display: `${wMatch[1]}w` };
        }

        const mMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:m|mo|mon|month|months)/);
        if (mMatch) {
            const months = parseFloat(mMatch[1]);
            const days = Math.round(months * 30.4375);
            return { years: days / 365.25, months, days, totalDays: days, display: `${months}m` };
        }

        const yMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:y|yr|yrs|year|years)?$/);
        if (yMatch) {
            const years = parseFloat(yMatch[1]);
            const days = Math.round(years * 365.25);
            return { years, months: years * 12, days, totalDays: days, display: `${years}y` };
        }
    }

    return { years: null, months: null, days: null, totalDays: null, display: '' };
};

const deriveAgeGroup = (patientOrInput) => {
    const { totalDays, years } = getAgeDetails(patientOrInput);
    if (totalDays == null && years == null) return 'Adult';

    if (totalDays != null) {
        if (totalDays <= 28) return 'Neonatal';
        if (totalDays <= 365) return 'Infant';
        const y = totalDays / 365.25;
        if (y < 13) return 'Pediatric';
        if (y < 19) return 'Adolescent';
        if (y < 65) return 'Adult';
        return 'Geriatric';
    }

    if (years != null) {
        if (years <= (28 / 365.25)) return 'Neonatal';
        if (years <= 1) return 'Infant';
        if (years < 13) return 'Pediatric';
        if (years < 19) return 'Adolescent';
        if (years < 65) return 'Adult';
        return 'Geriatric';
    }

    return 'Adult';
};

const AGE_GROUP_CONFIG = {
    Neonatal: { label: 'Neonatal (0-28d)', bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8', icon: '🍼' },
    Infant: { label: 'Infant (29d-1y)', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '👶' },
    Pediatric: { label: 'Pediatric (1-12y)', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: '🧒' },
    Adolescent: { label: 'Adolescent (13-18y)', bg: '#faf5ff', color: '#9333ea', border: '#e9d5ff', icon: '🧑' },
    Adult: { label: 'Adult (19-64y)', bg: '#f8fafc', color: '#475569', border: '#cbd5e1', icon: '👤' },
    Geriatric: { label: 'Geriatric (65+y)', bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '🧓' },
};

const calcBMI = (weight, height) => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100; // cm -> m
    if (!w || !h || h <= 0) return '';
    return (w / (h * h)).toFixed(1);
};

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];
const avatarColor = (s = '') => PALETTE[s.charCodeAt(0) % PALETTE.length];
const initials = (p) => {
    if (!p) return '?';
    const name = p.first_name || p.child_name || p.name || '?';
    return (name[0] + (p.last_name || '')[0]).toUpperCase();
};
const age = (patientOrInput) => {
    return getAgeDetails(patientOrInput).display || '';
};

const pname = (p) => {
    if (!p) return '';
    return [p.first_name || p.name, p.last_name].filter(Boolean).join(' ');
};

const fmt = (ds, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!ds) return ''; try { return new Date(ds).toLocaleDateString('en-IN', opts); } catch { return ds; }
};

const ClinicalEntry = () => {
    const [patients, setPatients] = useState([]);
    const [dirLoading, setDirLoading] = useState(true);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [records, setRecords] = useState([]);
    const [recLoading, setRecLoading] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [tab, setTab] = useState('details');
    const [keywordSearch, setKeywordSearch] = useState('');
    const [patientSearch, setPatientSearch] = useState('');
    const [appointmentSearch, setAppointmentSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_ENTRY);
    const [saving, setSaving] = useState(false);
    const [formStatus, setFormStatus] = useState({ error: null, success: null });
    const [exporting, setExporting] = useState(false);

    const [pendingCompletions, setPendingCompletions] = useState([]);
    const [pendingLoading, setPendingLoading] = useState(false);
    const [doctorsList, setDoctorsList] = useState([]);
    const [patientDetails, setPatientDetails] = useState(null);
    const [patientDetailsLoading, setPatientDetailsLoading] = useState(false);
    const [allergyDraft, setAllergyDraft] = useState({ ...EMPTY_ALLERGY });
    const [familyDiseaseDraft, setFamilyDiseaseDraft] = useState({ disease: '', relationship: '', age_at_onset: '', current_status: 'Managed' });
    const [diagnosisDraft, setDiagnosisDraft] = useState({ ...EMPTY_DIAGNOSIS_DRAFT });
    const [investigationDraft, setInvestigationDraft] = useState({ ...EMPTY_INVESTIGATION_DRAFT });
    const [procedureDraft, setProcedureDraft] = useState({ ...EMPTY_PROCEDURE_DRAFT });
    const [medicationHistoryDraft, setMedicationHistoryDraft] = useState({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
    const [prescriptionDraft, setPrescriptionDraft] = useState({ ...EMPTY_PRESCRIPTION_DRAFT });
    const [globalDays, setGlobalDays] = useState('');
    const [referralDraft, setReferralDraft] = useState({ location: '', speciality: '', doctor: '' });
    const [masterData, setMasterData] = useState({
        icd10: [],
        medicines: [],
        investigations: [],
        procedures: [],
        complaints: [],
        allergies: [],
        diagrams: [],
        noteTemplates: [],
        adviceTemplates: []
    });
    const [referralTargets, setReferralTargets] = useState([]);
    const [clinicalContext, setClinicalContext] = useState({ vitals_history: [], allergy_summary: [], current_meds: [], patient_history: [] });

    const [activeStep, setActiveStep] = useState(1);
    const [clinicalTemplates, setClinicalTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);

    const loadClinicalTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const res = await getTemplates();
            if (res.data?.success && Array.isArray(res.data.data)) {
                setClinicalTemplates(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load clinical templates:', err);
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadClinicalTemplates();
    }, [loadClinicalTemplates]);

    const applyQuickTemplate = (templateOrKey) => {
        let tmpl = null;
        if (typeof templateOrKey === 'string') {
            tmpl = QUICK_CLINICAL_TEMPLATES[templateOrKey] || clinicalTemplates.find(t => t.id === templateOrKey || t._id === templateOrKey || t.title === templateOrKey || t.name === templateOrKey);
        } else if (typeof templateOrKey === 'object' && templateOrKey !== null) {
            tmpl = templateOrKey;
        }

        if (!tmpl) return;

        const meta = tmpl.metadata || {};
        const name = tmpl.title || tmpl.name || 'Template';
        const complaints = meta.complaints || tmpl.complaints || [];
        const hpi = meta.hpi || tmpl.hpi || (tmpl.type === 'note' ? tmpl.content : '');
        const exam = meta.exam || tmpl.exam || {};
        const diagnoses = meta.diagnoses || tmpl.diagnoses || [];
        const investigations = meta.investigations || tmpl.investigations || [];
        const prescriptions = meta.prescriptions || tmpl.prescriptions || [];
        const advice_home_care = meta.advice_home_care || tmpl.advice_home_care || (tmpl.type === 'advice' ? tmpl.content : '');
        const advice_warning_signs = meta.advice_warning_signs || tmpl.advice_warning_signs || '';
        const next_visit_due = meta.next_visit_due || tmpl.next_visit_due;

        setForm(prev => {
            const existingComplaints = Array.isArray(prev.chief_complaints_list) ? prev.chief_complaints_list : [];
            const mergedComplaints = complaints.length ? Array.from(new Set([...existingComplaints, ...complaints])) : existingComplaints;

            const existingDiagnoses = Array.isArray(prev.provisional_diagnoses) ? prev.provisional_diagnoses : [];
            const mergedDiagnoses = diagnoses.length ? [...existingDiagnoses, ...diagnoses] : existingDiagnoses;

            const existingInvs = Array.isArray(prev.investigations_list) ? prev.investigations_list : [];
            const mergedInvs = investigations.length ? [...existingInvs, ...investigations] : existingInvs;

            const existingPrescriptions = Array.isArray(prev.prescriptions_list) ? prev.prescriptions_list : [];
            const mergedPrescriptions = prescriptions.length ? [...existingPrescriptions, ...prescriptions] : existingPrescriptions;

            return {
                ...prev,
                chief_complaints_list: mergedComplaints,
                chief_complaint: complaints.length ? (prev.chief_complaint ? `${prev.chief_complaint}, ${complaints.join(', ')}` : complaints.join(', ')) : prev.chief_complaint,
                history_of_present_illness: hpi ? (prev.history_of_present_illness ? `${prev.history_of_present_illness}\n\n${hpi}` : hpi) : prev.history_of_present_illness,
                pe_pallor: exam.pe_pallor || prev.pe_pallor || 'Absent',
                pe_cyanosis: exam.pe_cyanosis || prev.pe_cyanosis || 'Absent',
                pe_icterus: prev.pe_icterus || 'Absent',
                pe_oedema: exam.pe_oedema || prev.pe_oedema || 'Absent',
                pe_clubbing: prev.pe_clubbing || 'Absent',
                pe_lymphadenopathy: prev.pe_lymphadenopathy || 'Absent',
                physical_examination: exam.physical_examination ? (prev.physical_examination ? `${prev.physical_examination}\n${exam.physical_examination}` : exam.physical_examination) : prev.physical_examination,
                systemic_examination: exam.systemic_examination ? (prev.systemic_examination ? `${prev.systemic_examination}\n${exam.systemic_examination}` : exam.systemic_examination) : prev.systemic_examination,
                provisional_diagnoses: mergedDiagnoses,
                diagnosis: mergedDiagnoses.length ? mergedDiagnoses.map(d => d.diagnosis_name || d.diagnosis).join(', ') : prev.diagnosis,
                investigations_list: mergedInvs,
                prescriptions_list: mergedPrescriptions,
                advice_home_care: advice_home_care ? (prev.advice_home_care ? `${prev.advice_home_care}\n${advice_home_care}` : advice_home_care) : prev.advice_home_care,
                advice_warning_signs: advice_warning_signs ? (prev.advice_warning_signs ? `${prev.advice_warning_signs}\n${advice_warning_signs}` : advice_warning_signs) : prev.advice_warning_signs,
                next_visit_due: next_visit_due || prev.next_visit_due
            };
        });
        setFormStatus({ error: null, success: `✨ Applied "${name}" from Clinical Templates library!` });
        setTimeout(() => setFormStatus(prev => ({ ...prev, success: null })), 4000);
    };

    const handleSaveAsTemplate = async () => {
        const defaultName = form.diagnosis || form.chief_complaint || 'Custom Clinical Template';
        const name = window.prompt('Enter a title for this Clinical Template:', defaultName);
        if (!name || !name.trim()) return;

        try {
            const templatePayload = {
                name: name.trim(),
                title: name.trim(),
                type: 'condition',
                content: form.history_of_present_illness || form.clinical_notes || `Consultation template for ${name.trim()}`,
                metadata: {
                    icon: '⚡',
                    badge: form.age_group || 'Clinical Template',
                    allergies: form.allergies || [],
                    complaints: form.chief_complaints_list || (form.chief_complaint ? [form.chief_complaint] : []),
                    hpi: form.history_of_present_illness || '',
                    exam: {
                        pe_pallor: form.pe_pallor || 'Absent',
                        pe_cyanosis: form.pe_cyanosis || 'Absent',
                        pe_icterus: form.pe_icterus || 'Absent',
                        pe_oedema: form.pe_oedema || 'Absent',
                        physical_examination: form.physical_examination || '',
                        systemic_examination: form.systemic_examination || ''
                    },
                    diagnoses: (form.provisional_diagnoses || []).map(d => ({
                        diagnosis_name: d.diagnosis_name || d.diagnosis,
                        icd_10: d.icd_10 || d.code || '',
                        severity: d.severity || 'Moderate',
                        stage: d.stage || 'Provisional'
                    })),
                    investigations: (form.investigations_list || []).map(i => ({
                        name: i.name || i.test_name,
                        priority: i.priority || 'Routine',
                        timeframe: i.timeframe || 'Routine'
                    })),
                    procedures: (form.procedures_list || []).map(p => ({
                        name: p.name,
                        procedure_type: p.procedure_type || 'Therapeutic'
                    })),
                    prescriptions: (form.prescriptions_list || []).map(p => ({
                        medicine: p.medicine,
                        dosage_form: p.dosage_form || 'Tablet',
                        schedule: p.schedule || '',
                        days: p.days || 3,
                        quantity: p.quantity || '1 bottle',
                        instruction: p.instruction || ''
                    })),
                    advice_home_care: form.advice_home_care || '',
                    advice_diet: form.advice_diet || form.dietary_plan || '',
                    advice_warning_signs: form.advice_warning_signs || '',
                    next_visit_due: form.next_visit_due || '3 days'
                }
            };
            await upsertClinicalTemplate(templatePayload);
            setFormStatus({ error: null, success: `✅ Successfully saved "${name.trim()}" to Clinical Templates!` });
            loadClinicalTemplates();
            setTimeout(() => setFormStatus(prev => ({ ...prev, success: null })), 4000);
        } catch (err) {
            setFormStatus({ error: 'Failed to save clinical template: ' + (err.response?.data?.message || err.message), success: null });
        }
    };

    const handleToggleComplaintChip = (chip) => {
        setForm(prev => {
            const list = Array.isArray(prev.chief_complaints_list) ? [...prev.chief_complaints_list] : [];
            const idx = list.indexOf(chip);
            let updatedList;
            if (idx >= 0) {
                updatedList = list.filter(c => c !== chip);
            } else {
                updatedList = [...list, chip];
            }
            return {
                ...prev,
                chief_complaints_list: updatedList,
                chief_complaint: updatedList.join(', ')
            };
        });
    };

    const handleAddDiagnosisItem = () => {
        if (!diagnosisDraft.diagnosis_name.trim()) return;
        setForm(prev => ({
            ...prev,
            provisional_diagnoses: [...(prev.provisional_diagnoses || []), { ...diagnosisDraft }]
        }));
        setDiagnosisDraft({ ...EMPTY_DIAGNOSIS_DRAFT });
    };

    const handleRemoveDiagnosisItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.provisional_diagnoses || [])];
            updated.splice(index, 1);
            return { ...prev, provisional_diagnoses: updated };
        });
    };

    const handleAddInvestigationItem = (nameOverride = null) => {
        const testName = nameOverride || investigationDraft.name;
        if (!testName.trim()) return;
        setForm(prev => ({
            ...prev,
            investigations_list: [...(prev.investigations_list || []), {
                ...investigationDraft,
                name: testName,
                test_name: testName
            }]
        }));
        setInvestigationDraft({ ...EMPTY_INVESTIGATION_DRAFT });
    };

    const handleRemoveInvestigationItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.investigations_list || [])];
            updated.splice(index, 1);
            return { ...prev, investigations_list: updated };
        });
    };

    const handleAddProcedureItem = (nameOverride = null) => {
        const procName = nameOverride || procedureDraft.name;
        if (!procName.trim()) return;
        setForm(prev => ({
            ...prev,
            procedures_list: [...(prev.procedures_list || []), {
                ...procedureDraft,
                name: procName
            }]
        }));
        setProcedureDraft({ ...EMPTY_PROCEDURE_DRAFT });
    };

    const handleRemoveProcedureItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.procedures_list || [])];
            updated.splice(index, 1);
            return { ...prev, procedures_list: updated };
        });
    };

    const handleAddPrescriptionItem = (medOverride = null) => {
        const med = medOverride ? { ...EMPTY_PRESCRIPTION_DRAFT, ...medOverride } : prescriptionDraft;
        if (!med.medicine.trim()) return;
        setForm(prev => ({
            ...prev,
            prescriptions_list: [...(prev.prescriptions_list || []), { ...med }]
        }));
        setPrescriptionDraft({ ...EMPTY_PRESCRIPTION_DRAFT });
    };

    const handleRemovePrescriptionItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.prescriptions_list || [])];
            updated.splice(index, 1);
            return { ...prev, prescriptions_list: updated };
        });
    };

    const handleAddAllergyItem = () => {
        if (!allergyDraft.type.trim()) return;
        setForm(prev => ({
            ...prev,
            allergies: [...(prev.allergies || []), { ...allergyDraft }]
        }));
        setAllergyDraft({ ...EMPTY_ALLERGY });
    };

    const handleRemoveAllergyItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.allergies || [])];
            updated.splice(index, 1);
            return { ...prev, allergies: updated };
        });
    };

    const handleAddPriorMedItem = () => {
        if (!medicationHistoryDraft.drug.trim()) return;
        setForm(prev => ({
            ...prev,
            medication_history: [...(prev.medication_history || []), { ...medicationHistoryDraft }]
        }));
        setMedicationHistoryDraft({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
    };

    const handleRemovePriorMedItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.medication_history || [])];
            updated.splice(index, 1);
            return { ...prev, medication_history: updated };
        });
    };

    const handleAddFamilyDiseaseItem = () => {
        if (!familyDiseaseDraft.disease.trim()) return;
        setForm(prev => ({
            ...prev,
            family_diseases: [...(prev.family_diseases || []), { ...familyDiseaseDraft }]
        }));
        setFamilyDiseaseDraft({ disease: '', relationship: '', age_at_onset: '', current_status: 'Managed' });
    };

    const handleRemoveFamilyDiseaseItem = (index) => {
        setForm(prev => {
            const updated = [...(prev.family_diseases || [])];
            updated.splice(index, 1);
            return { ...prev, family_diseases: updated };
        });
    };

    const handleSetNormalExam = () => {
        setForm(prev => ({
            ...prev,
            pe_pallor: 'Absent',
            pe_icterus: 'Absent',
            pe_oedema: 'Absent',
            pe_cyanosis: 'Absent',
            pe_clubbing: 'Absent',
            pe_lymphadenopathy: 'Absent',
            physical_examination: 'Active, alert, well-hydrated. Tone and reflexes normal. Throat clear, no stridor, no distress.',
            systemic_examination: 'Chest: Bilateral air entry equal, clear, no wheeze or crackles. CVS: S1 S2 heard normal, no murmurs. Abdomen: Soft, non-tender, no organomegaly. CNS: Alert, oriented.'
        }));
        setFormStatus({ error: null, success: '✓ Set all general & systemic physical examinations to Normal.' });
        setTimeout(() => setFormStatus(prev => ({ ...prev, success: null })), 3000);
    };

    const loadDirectory = useCallback(async (q = '') => {
        setDirLoading(true);
        try {
            const r = await getPatients({ limit: 50, search: q });
            setPatients(r.data.data || []);
        }
        catch (e) { console.error(e); }
        finally { setDirLoading(false); }
    }, []);

    const loadWorklist = useCallback(async () => {
        setPendingLoading(true);
        try {
            // Fetch completed appointments for last 7 days to keep it reasonable
            const d = new Date();
            d.setDate(d.getDate() - 7);
            const r = await getAppointments({
                status: 'COMPLETED',
                limit: 100
            });
            // Filter ones that don't have mrd entry yet
            const list = (r.data?.data || []).filter(a => !a.has_mrd_entry);
            setPendingCompletions(list);
        } catch (e) {
            console.error('Worklist fetch failed', e);
        } finally {
            setPendingLoading(false);
        }
    }, []);

    const loadDoctors = useCallback(async () => {
        try {
            const r = await getDoctors({ all: true });
            setDoctorsList(r.data?.data || []);
        } catch (e) {
            console.error('Failed to fetch doctors', e);
        }
    }, []);

    const loadMasterData = useCallback(async () => {
        try {
            const [allMaster, diagrams, noteTmpl, adviceTmpl] = await Promise.all([
                getMasterData(), // Fetch all generic clinical master data
                getClinicalDiagramTemplates(),
                getClinicalNoteTemplates(),
                getCareAdviceTemplates()
            ]);
            
            const masterList = allMaster.data?.data || [];
            
            setMasterData({
                icd10: masterList.filter(i => i.category === 'diagnosis').map(i => ({ name: i.name, code: i.metadata?.code })),
                medicines: masterList.filter(i => i.category === 'medicine'),
                investigations: masterList.filter(i => i.category === 'investigation'),
                procedures: masterList.filter(i => i.category === 'procedure'),
                complaints: masterList.filter(i => i.category === 'complaint'),
                allergies: masterList.filter(i => i.category === 'allergy'),
                diagrams: diagrams.data?.data || [],
                noteTemplates: noteTmpl.data?.data || [],
                adviceTemplates: adviceTmpl.data?.data || []
            });
        } catch (e) {
            console.error('Failed to fetch clinical master data', e);
        }
    }, []);

    const loadReferralTargets = useCallback(async () => {
        try {
            const response = await getReferralTargets();
            setReferralTargets(response.data?.data || []);
        } catch (e) {
            console.error('Failed to fetch referral targets', e);
        }
    }, []);

    const loadClinicalContext = useCallback(async (patientId) => {
        if (!patientId) return;
        try {
            const [vitalsRes, allergyRes, medsRes, historyRes] = await Promise.all([
                getPatientVitalsHistory(patientId),
                getPatientAllergySummary(patientId),
                getPatientCurrentMeds(patientId),
                getPatientHistory(patientId)
            ]);
            setClinicalContext({
                vitals_history: vitalsRes.data?.data || [],
                allergy_summary: allergyRes.data?.data || [],
                current_meds: medsRes.data?.data || [],
                patient_history: historyRes.data?.data?.timeline || []
            });
            const allergySummary = allergyRes.data?.data || [];
            const currentMeds = medsRes.data?.data || [];
            setForm((prev) => ({
                ...prev,
                allergies: (prev.allergies && prev.allergies.length > 0)
                    ? prev.allergies
                    : allergySummary.map((name) => ({ category: 'History', type: name, reaction: '', intensity: '', duration: '', informed_by: 'History' })),
                medication_history: (prev.medication_history && prev.medication_history.length > 0)
                    ? prev.medication_history
                    : currentMeds.map((item) => ({
                        drug: item.medicine || '',
                        form: '',
                        dose: item.dosage || '',
                        route: '',
                        frequency: '',
                        to_be_continued: item.is_to_be_continued ? 'Yes' : 'No'
                    }))
            }));
        } catch (e) {
            console.error('Failed to load patient clinical context', e);
            setClinicalContext({ vitals_history: [], allergy_summary: [], current_meds: [], patient_history: [] });
        }
    }, []);

    useEffect(() => { loadWorklist(); loadDoctors(); loadMasterData(); loadReferralTargets(); }, [loadWorklist, loadDoctors, loadMasterData, loadReferralTargets]);

    // Debounced directory search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadDirectory(patientSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [patientSearch, loadDirectory]);

    // Auto-sync demographic age_group with patient's DOB
    useEffect(() => {
        const dob = patientDetails?.dob || selectedPatient?.dob;
        if (dob) {
            const derivedAg = deriveAgeGroup(dob);
            if (form.age_group !== derivedAg) {
                setForm(prev => ({ ...prev, age_group: derivedAg }));
            }
        }
    }, [patientDetails?.dob, selectedPatient?.dob, form.age_group]);

    const selectPatientRecord = async (p, prefFromAppt = null) => {
        if (selectedPatient?.patient_id !== p.patient_id) {
            setSelectedPatient(p);
            setRecords([]);
            setSelectedRecord(null);
            setKeywordSearch('');
            setFilterType('ALL');
            setRecLoading(true);
            try {
                const r = await getComprehensiveProfile(p.patient_id);
                const { patient, appointments, mrd_entries } = r.data?.data || {};
                
                setPatientDetails(patient);
                setForm(prev => ({ ...prev, patient_id: p.patient_id, age_group: deriveAgeGroup(patient || p) }));
                
                // Combine entries and "ghost" entries for completed appointments
                const combined = [...(mrd_entries || [])];
                
                (appointments || []).forEach(appt => {
                    if (appt.status === 'COMPLETED' && !mrd_entries.find(e => e.appointment_id === appt.appointment_id)) {
                        combined.push({
                            is_pending_record: true,
                            appointment_id: appt.appointment_id,
                            visit_date: appt.appointment_date,
                            visit_category: appt.visit_category,
                            attending_doctor: appt.doctor_name,
                            diagnosis: 'Pending Documentation',
                            reason: appt.reason,
                            weight: appt.weight,
                            temperature: appt.temperature,
                            spo2: appt.spo2,
                            pulse: appt.pulse,
                            head_circumference: appt.head_circumference,
                            symptoms: appt.symptoms
                        });
                    }
                });

                combined.sort((a, b) => new Date(b.visit_date || b.createdAt) - new Date(a.visit_date || a.createdAt));
                setRecords(combined);
                if (combined.length) {
                    setSelectedRecord(combined[0]);
                    setShowModal(false);
                } else {
                    setSelectedRecord(null);
                    setShowModal(true);
                }

                // Also update clinical context from mrd_entries
                const vitals = (mrd_entries || []).filter(e => e.weight || e.height || e.temperature).map(e => ({
                    date: e.visit_date, weight: e.weight, height: e.height, temperature: e.temperature, pulse: e.pulse, spo2: e.spo2
                }));
                setClinicalContext({
                    vitals_history: vitals,
                    allergy_summary: [], // Could be derived if structured
                    current_meds: [],    // Could be derived if structured
                    patient_history: mrd_entries || []
                });

            } catch (e) {
                console.error('Failed to fetch comprehensive profile', e);
            } finally {
                setRecLoading(false);
            }
        }

        if (prefFromAppt) {
            setShowModal(true);
            setFormStatus({ error: null, success: null });
            setForm({
                ...EMPTY_ENTRY,
                patient_id: p.patient_id,
                appointment_id: prefFromAppt.appointment_id,
                visit_date: prefFromAppt.appointment_date ? prefFromAppt.appointment_date.split('T')[0] : toIsoDate(),
                visit_type: prefFromAppt.visit_category === 'Vaccination' ? 'VACCINATION' : 'CONSULTATION',
                attending_doctor: prefFromAppt.attending_doctor || prefFromAppt.doctor_name || 'Dr. Deepak',
                chief_complaint: prefFromAppt.reason || '',
                weight: prefFromAppt.weight || '',
                temperature: prefFromAppt.temperature || '',
                spo2: prefFromAppt.spo2 || '',
                pulse: prefFromAppt.pulse || '',
                head_circumference: prefFromAppt.head_circumference || '',
                symptoms: Array.isArray(prefFromAppt.symptoms) ? prefFromAppt.symptoms.join(', ') : (prefFromAppt.symptoms || '')
            });
            setAllergyDraft({ ...EMPTY_ALLERGY });
            setFamilyDiseaseDraft({ disease: '', relationship: '' });
            setDiagnosisDraft({ ...EMPTY_DIAGNOSIS_DRAFT });
            setInvestigationDraft({ ...EMPTY_INVESTIGATION_DRAFT });
            setProcedureDraft({ ...EMPTY_PROCEDURE_DRAFT });
            setMedicationHistoryDraft({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
            setPrescriptionDraft({ ...EMPTY_PRESCRIPTION_DRAFT });
            setGlobalDays('');
            setReferralDraft({ location: '', speciality: '', doctor: '' });
        }
    };

    const handleAppointmentLookup = async () => {
        const query = appointmentSearch.trim();
        if (!query) return;
        setRecLoading(true);
        try {
            // Use unified lookup
            const res = await lookupAppointments(query);
            if (res.data.type === 'single') {
                const appt = res.data.data;
                // Fetch patient and select record
                const pRes = await getPatients({ search: appt.patient_id });
                if (pRes.data?.data?.length > 0) {
                    await selectPatientRecord(pRes.data.data[0]);
                    setAppointmentSearch(''); // Clear search
                }
            } else {
                alert("Please enter a specific Appointment ID (APT-...) for direct lookup.");
            }
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || "Failed to lookup appointment");
        } finally {
            setRecLoading(false);
        }
    };

    const handleExport = async () => {
        if (!selectedPatient) return;
        setExporting(true);
        try {
            const r = await exportMRD(selectedPatient.patient_id);
            const b = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' });
            const u = URL.createObjectURL(b), a = document.createElement('a');
            a.href = u;
            a.download = `Medical_Docs_${selectedPatient.patient_id}_${toIsoDate()}.json`;
            a.click();
            URL.revokeObjectURL(u);
        } catch (e) { console.error(e); } finally { setExporting(false); }
    };

    const handlePrint = () => {
        if (!selectedRecord) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(generatePrescriptionHTML(selectedRecord, selectedPatient));
        printWindow.document.close();

        // Wait for logo to load before printing
        const img = printWindow.document.querySelector('.header-logo');
        if (img) {
            if (img.complete) {
                printWindow.print();
            } else {
                img.onload = () => {
                    printWindow.print();
                };
                img.onerror = () => {
                    console.error("Failed to load prescription logo");
                    printWindow.print(); // Print anyway if logo fails
                };
            }
        } else {
            printWindow.print();
        }
    };

    const generatePrescriptionHTML = (record, patient) => {
        const hasStructuredMeds = Array.isArray(record.prescriptions_list) && record.prescriptions_list.length > 0;
        const legacyMedicines = (record.prescription || "")
            .split("\n")
            .filter(Boolean)
            .map(line => {
                const parts = line.split(" - ");
                return {
                    name: parts[0] || "",
                    dose: parts[1] || "",
                    duration: parts[2] || ""
                };
            });

        return `
        <html>
        <head>
            <title>Prescription - ${patient?.first_name || patient?.name || 'Patient'}</title>
            <base href="${window.location.origin}/">
            <style>
                @page { size: A4; margin: 16mm; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    color: #1e293b;
                    line-height: 1.45;
                    font-size: 13px;
                    margin: 0;
                    padding: 10px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0f766e;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                }
                .header-brand {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .header-logo {
                    height: 64px;
                    width: auto;
                    border-radius: 6px;
                }
                .clinic-title {
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f766e;
                    margin: 0;
                }
                .clinic-sub {
                    font-size: 11px;
                    color: #64748b;
                    margin: 2px 0 0 0;
                }
                .patient-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 10px 14px;
                    margin-bottom: 16px;
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    font-size: 12px;
                }
                .patient-card strong { color: #334155; }
                .section {
                    margin-bottom: 14px;
                }
                .section-title {
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #0f766e;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 3px;
                    margin-bottom: 6px;
                }
                .vitals-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    background: #f0fdfa;
                    border: 1px solid #ccfbf1;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #115e59;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 4px;
                }
                th {
                    background: #f1f5f9;
                    color: #334155;
                    font-size: 11px;
                    text-transform: uppercase;
                    font-weight: 700;
                    padding: 6px 8px;
                    border: 1px solid #cbd5e1;
                    text-align: left;
                }
                td {
                    padding: 6px 8px;
                    border: 1px solid #e2e8f0;
                    font-size: 12px;
                    vertical-align: top;
                }
                .med-name { font-weight: 700; color: #0f172a; }
                .med-badge {
                    display: inline-block;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 1px 5px;
                    border-radius: 3px;
                    background: #e0f2fe;
                    color: #0369a1;
                    margin-left: 4px;
                }
                .med-indication {
                    font-size: 11px;
                    color: #0284c7;
                    font-style: italic;
                }
                .med-instruction {
                    font-size: 11px;
                    color: #475569;
                }
                .caution-box {
                    background: #fffbeb;
                    border-left: 3px solid #f59e0b;
                    padding: 6px 10px;
                    border-radius: 0 4px 4px 0;
                    font-size: 12px;
                    color: #92400e;
                    margin-top: 4px;
                }
                .footer {
                    margin-top: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 12px;
                    font-size: 12px;
                }
                .signature-box { text-align: right; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-brand">
                    <img src="logo.jpg" class="header-logo" alt="Logo" onerror="this.style.display='none'"/>
                    <div>
                        <h1 class="clinic-title">Hello Doctor Childcare Center</h1>
                        <p class="clinic-sub">Pediatric & Clinical Consultation Record</p>
                    </div>
                </div>
                <div style="text-align: right; font-size: 11px; color: #64748b;">
                    <strong>Prescription Date:</strong> ${new Date(record.visit_date).toLocaleDateString('en-IN')}<br/>
                    <strong>Ref/Visit:</strong> ${record.visit_type || 'Consultation'}
                </div>
            </div>

            <div class="patient-card">
                <div><strong>Patient:</strong> ${[patient?.first_name || patient?.name, patient?.last_name].filter(Boolean).join(' ') || '-'}</div>
                <div><strong>Patient ID:</strong> ${patient?.patient_id || '-'}</div>
                <div><strong>Age / Gender:</strong> ${age(patient?.dob) || '-'} / ${patient?.gender || '-'} (${record.age_group || deriveAgeGroup(patient?.dob)})</div>
                <div><strong>Doctor:</strong> ${record.attending_doctor || 'Dr. Deepak'}</div>
            </div>

            ${(record.temperature || record.pulse || record.spo2 || record.weight || record.height || record.pain_score || record.fall_risk) ? `
            <div class="section">
                <div class="vitals-bar">
                    ${record.temperature ? `<span><strong>Temp:</strong> ${record.temperature} °F</span>` : ''}
                    ${record.pulse ? `<span><strong>Pulse:</strong> ${record.pulse} bpm</span>` : ''}
                    ${record.spo2 ? `<span><strong>SpO2:</strong> ${record.spo2}%</span>` : ''}
                    ${record.weight ? `<span><strong>Weight:</strong> ${record.weight} kg</span>` : ''}
                    ${record.height ? `<span><strong>Height:</strong> ${record.height} cm</span>` : ''}
                    ${record.bmi ? `<span><strong>BMI:</strong> ${record.bmi}</span>` : ''}
                    ${record.pain_score ? `<span><strong>Pain Score:</strong> ${record.pain_score}/10</span>` : ''}
                    ${record.fall_risk ? `<span><strong>Fall Risk:</strong> ${record.fall_risk}</span>` : ''}
                    ${record.neonatal_history?.birth_weight ? `<span><strong>Birth Wt:</strong> ${record.neonatal_history.birth_weight} kg</span>` : ''}
                </div>
            </div>` : ''}

            ${(record.chief_complaint || record.clinical_notes || record.diagnosis) ? `
            <div class="section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    ${record.chief_complaint ? `<strong>Chief Complaint:</strong> ${record.chief_complaint}<br/>` : ''}
                    ${record.diagnosis ? `<strong>Diagnosis:</strong> <span style="color:#0f766e; font-weight:700;">${record.diagnosis}</span>` : ''}
                </div>
                <div>
                    ${record.clinical_notes ? `<strong>Clinical Notes:</strong> ${record.clinical_notes}` : ''}
                </div>
            </div>` : ''}

            <!-- ── Medication Advice (Rx) ── -->
            <div class="section">
                <div class="section-title">Rx - Medication Advice</div>
                ${hasStructuredMeds ? `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 25px;">#</th>
                            <th>Medicine & Formulation</th>
                            <th>Indication</th>
                            <th>Schedule & Route</th>
                            <th style="width: 70px;">Duration</th>
                            <th style="width: 70px;">Qty/Refills</th>
                            <th>Instructions & Precautions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${record.prescriptions_list.map((m, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>
                                    <span class="med-name">${m.medicine}</span>
                                    ${m.dosage_form ? `<span class="med-badge">${m.dosage_form}</span>` : ''}
                                    ${m.type === 'Generic' ? `<span style="font-size:10px; color:#64748b; display:block;">(Generic)</span>` : ''}
                                </td>
                                <td><span class="med-indication">${m.indication || '-'}</span></td>
                                <td><strong>${m.schedule || '-'}</strong><br/><span style="font-size: 10px; color:#64748b;">${m.route || 'ORAL'}</span></td>
                                <td>${m.days ? `${m.days} days` : '-'}</td>
                                <td>${m.quantity || '-'}${m.refills && m.refills !== '0' ? `<br/><small>Refill: ${m.refills}</small>` : ''}</td>
                                <td>
                                    <div class="med-instruction">${m.instruction || ''}</div>
                                    ${m.special_instructions ? `<div style="font-size:11px; color:#b45309; font-weight:600;">⚠ ${m.special_instructions}</div>` : ''}
                                    ${m.pharmacist_notes ? `<div style="font-size:10px; color:#0d9488;">ℹ ${m.pharmacist_notes}</div>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : (legacyMedicines.length > 0 ? `
                <table>
                    <thead>
                        <tr><th>#</th><th>Medicine</th><th>Dose</th><th>Duration</th></tr>
                    </thead>
                    <tbody>
                        ${legacyMedicines.map((m, idx) => `
                            <tr><td>${idx + 1}</td><td><strong>${m.name}</strong></td><td>${m.dose}</td><td>${m.duration}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : `<div>${record.prescription || 'No active prescription recorded.'}</div>`)}
            </div>

            <!-- ── Other Medications (OTC / Supplements) ── -->
            ${record.other_medication ? `
            <div class="section">
                <div class="section-title">Other Medications (OTC & Supplements)</div>
                <div style="background: #f8fafc; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px; white-space: pre-line;">
                    ${record.other_medication}
                </div>
            </div>` : ''}

            <!-- ── Non-Medication Prescriptions ── -->
            ${(record.dietary_plan || record.advice_diet || record.activity_restrictions || record.home_monitoring || record.school_work_note) ? `
            <div class="section">
                <div class="section-title">Non-Medication Prescriptions & Care Plan</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                    ${(record.dietary_plan || record.advice_diet) ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px;">
                        <strong>🥗 Dietary & Nutrition Plan:</strong><br/>
                        ${record.dietary_plan || record.advice_diet}
                    </div>` : ''}
                    ${record.activity_restrictions ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px;">
                        <strong>🏃 Activity Restrictions:</strong><br/>
                        ${record.activity_restrictions}
                    </div>` : ''}
                    ${record.home_monitoring ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px;">
                        <strong>🩺 Home Monitoring:</strong><br/>
                        ${record.home_monitoring}
                    </div>` : ''}
                    ${record.school_work_note ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px;">
                        <strong>📝 School / Work Excuse:</strong><br/>
                        ${record.school_work_note}
                    </div>` : ''}
                </div>
            </div>` : ''}

            <!-- ── Investigations & Procedures ── -->
            ${((record.investigations_list?.length > 0) || record.investigations || (record.procedures_list?.length > 0)) ? `
            <div class="section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                ${(record.investigations_list?.length > 0 || record.investigations) ? `
                <div>
                    <div class="section-title">Investigations Advised</div>
                    ${record.investigations_list?.length > 0 ? `
                        <ul style="margin: 0; padding-left: 18px; font-size: 12px;">
                            ${record.investigations_list.map(i => `
                                <li><strong>${i.test_name || i.name}</strong> ${i.timeframe ? `<span style="color:#0284c7;">(${i.timeframe})</span>` : ''} ${i.indication ? `- <em>${i.indication}</em>` : ''}</li>
                            `).join('')}
                        </ul>
                    ` : `<div>${record.investigations}</div>`}
                </div>` : ''}
                ${(record.procedures_list?.length > 0) ? `
                <div>
                    <div class="section-title">Procedures Advised</div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px;">
                        ${record.procedures_list.map(p => `
                            <li><strong>${p.name}</strong> ${p.procedure_type ? `<span style="color:#0f766e;">[${p.procedure_type}]</span>` : ''} ${p.location ? `(Location: ${p.location})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>` : ''}
            </div>` : ''}

            <!-- ── Patient Safety & Storage ── -->
            ${(record.storage_instructions || record.side_effects_warning || record.advice_warning_signs) ? `
            <div class="section">
                <div class="section-title">Patient Safety, Storage & Warnings</div>
                <div class="caution-box">
                    ${record.storage_instructions ? `<div><strong>Storage:</strong> ${record.storage_instructions}</div>` : ''}
                    ${record.side_effects_warning ? `<div><strong>Side Effects Watch:</strong> ${record.side_effects_warning}</div>` : ''}
                    ${record.advice_warning_signs ? `<div><strong>Urgent Return Signs:</strong> ${record.advice_warning_signs}</div>` : ''}
                </div>
            </div>` : ''}

            ${record.advice ? `
            <div class="section">
                <div class="section-title">General Advice</div>
                <div style="font-size: 12px; white-space: pre-line;">${record.advice}</div>
            </div>` : ''}

            <div class="footer">
                <div>
                    ${record.next_visit_due ? `<strong>Next Follow-up Due:</strong> ${new Date(record.next_visit_due).toLocaleDateString('en-IN')}` : 'Follow up as needed or if symptoms persist.'}
                </div>
                <div class="signature-box">
                    <div style="height: 35px;"></div>
                    <strong>${record.attending_doctor || 'Dr. Deepak'}</strong><br/>
                    <span style="font-size: 10px; color:#64748b;">Authorized Medical Practitioner</span>
                </div>
            </div>
        </body>
        </html>
        `;
    };

    const handleAddEntry = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormStatus({ error: null, success: null });
        try {
            const sym = typeof form.symptoms === 'string'
                ? form.symptoms.split(',').map(s => s.trim()).filter(Boolean)
                : form.symptoms;

            // Fail-safe: Include draft data if the doctor forgot to click "Add"
            const finalDiagnoses = [...(form.provisional_diagnoses || [])];
            if (diagnosisDraft.diagnosis_name && !finalDiagnoses.some(d => d.diagnosis_name === diagnosisDraft.diagnosis_name)) {
                finalDiagnoses.push(diagnosisDraft);
            }

            const finalInvestigations = [...(form.investigations_list || [])];
            if (investigationDraft.name && !finalInvestigations.some(i => i.name === investigationDraft.name)) {
                finalInvestigations.push(investigationDraft);
            }

            const finalProcedures = [...(form.procedures_list || [])];
            if (procedureDraft.name && !finalProcedures.some(p => p.name === procedureDraft.name)) {
                finalProcedures.push(procedureDraft);
            }

            const finalPrescriptions = [...(form.prescriptions_list || [])];
            if (prescriptionDraft.medicine && !finalPrescriptions.some(p => p.medicine === prescriptionDraft.medicine)) {
                finalPrescriptions.push(prescriptionDraft);
            }

            const payload = {
                ...form,
                patient_id: form.patient_id || selectedPatient?.patient_id,
                symptoms: sym,
                chief_complaint: form.chief_complaint || (form.chief_complaints_list || []).join(', '),
                diagnosis: form.diagnosis || finalDiagnoses.map(d => `${d.diagnosis_name || d.diagnosis}${d.severity ? ` (${d.severity})` : ''}`).filter(Boolean).join(', '),
                prescription: form.prescription || finalPrescriptions.map(p => `${p.medicine} [${p.dosage_form || 'Form'}] - ${p.schedule} - ${p.days || '0'} days${p.indication ? ` (For: ${p.indication})` : ''}${p.quantity ? ` [Qty: ${p.quantity}]` : ''}${p.special_instructions ? ` - Note: ${p.special_instructions}` : ''}`).filter(Boolean).join('\n'),
                provisional_diagnoses: finalDiagnoses.map((diag) => ({
                    diagnosis: diag.diagnosis_name || diag.diagnosis || '',
                    code: diag.icd_10 || diag.code || '',
                    stage: diag.stage || '',
                    type: diag.type || '',
                    severity: diag.severity || '',
                    comorbidity: diag.comorbidity || '',
                    notes: diag.notes || ''
                })),
                investigations_list: finalInvestigations.map((item) => ({
                    test_name: item.name || item.test_name || '',
                    priority: item.priority || 'Routine',
                    timeframe: item.timeframe || item.priority || 'Routine',
                    indication: item.indication || '',
                    notes: item.notes || ''
                })),
                investigations: form.investigations || finalInvestigations.map(i => `${i.name || i.test_name}${i.timeframe ? ` (${i.timeframe})` : ''}`).filter(Boolean).join(', '),
                procedures_list: finalProcedures.map((item) => ({
                    name: item.name || '',
                    procedure_type: item.procedure_type || 'Therapeutic',
                    location: item.location || 'In clinic'
                })),
                advice: form.advice || [
                    form.advice_home_care ? `HOME CARE:\n${form.advice_home_care}` : '',
                    (form.advice_diet || form.dietary_plan) ? `DIET:\n${form.dietary_plan || form.advice_diet}` : '',
                    form.activity_restrictions ? `ACTIVITY:\n${form.activity_restrictions}` : '',
                    form.home_monitoring ? `MONITORING:\n${form.home_monitoring}` : '',
                    form.storage_instructions ? `STORAGE:\n${form.storage_instructions}` : '',
                    (form.advice_warning_signs || form.side_effects_warning) ? `WARNING SIGNS & SAFETY:\n${[form.advice_warning_signs, form.side_effects_warning].filter(Boolean).join('\n')}` : '',
                    form.school_work_note ? `SCHOOL/WORK:\n${form.school_work_note}` : ''
                ].filter(Boolean).join('\n\n'),
                visit_tags: form.visit_tags || [],
                consents: form.consents || [],
                medication_history: (form.medication_history || []).map((item) => ({
                    medicine: item.drug || item.medicine || '',
                    dosage: [item.form, item.dose, item.frequency].filter(Boolean).join(' | '),
                    is_to_be_continued: String(item.to_be_continued || '').toLowerCase() === 'yes' || item.is_to_be_continued === true,
                    notes: item.notes || ''
                })),
                prescriptions_list: finalPrescriptions.map((item) => ({
                    medicine: item.medicine || '',
                    generic_name: item.type === 'Generic' ? item.medicine : (item.generic_name || ''),
                    dosage_form: item.dosage_form || 'Tablet',
                    indication: item.indication || '',
                    dosage: item.dosage || '',
                    schedule: item.schedule || '',
                    route: item.route || 'ORAL',
                    instruction: item.instruction || '',
                    special_instructions: item.special_instructions || '',
                    pharmacist_notes: item.pharmacist_notes || 'Substitute allowed',
                    quantity: item.quantity || '',
                    refills: item.refills || '0',
                    days: item.days ? Number(item.days) : null
                })),
                age_group: form.age_group || deriveAgeGroup(patientDetails?.dob || selectedPatient?.dob),
                pain_score: form.pain_score || '',
                fall_risk: form.fall_risk || '',
                neonatal_history: form.neonatal_history || {},
                pediatric_assessment: form.pediatric_assessment || {},
                adolescent_assessment: form.adolescent_assessment || {},
                adult_assessment: form.adult_assessment || {},
                geriatric_assessment: form.geriatric_assessment || {},
                structured_family_history: (form.structured_family_history?.length > 0 ? form.structured_family_history : form.family_diseases) || [],
                next_visit_due: computeNextVisitDueDate(form.next_visit_due)
            };

            await addMRDEntry(payload);
            setFormStatus({ error: null, success: 'Entry added successfully.' });
            setForm(EMPTY_ENTRY);
            // Refresh worklist since an entry was added
            loadWorklist();
            if (selectedPatient) {
                const r = await getMRDByPatientId(selectedPatient.patient_id);
                setRecords(r.data?.data?.entries || []);
            }
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            if (errorMsg.includes("E11000") && errorMsg.includes("patient_id")) {
                setFormStatus({ error: "Conflict: This Patient ID already has an existing E-prescription record. Multiple records for the same ID are not allowed.", success: null });
            } else {
                setFormStatus({ error: errorMsg, success: null });
            }
        }
        finally { setSaving(false); }
    };

    const openEntryModal = async () => {
        setShowModal(true);
        setFormStatus({ error: null, success: null });
        const initAgeGroup = deriveAgeGroup(selectedPatient?.dob);
        setForm({ ...EMPTY_ENTRY, patient_id: selectedPatient?.patient_id || '', age_group: initAgeGroup, attachments: [] });
        setAllergyDraft({ ...EMPTY_ALLERGY });
        setFamilyDiseaseDraft({ disease: '', relationship: '' });
        setDiagnosisDraft({ ...EMPTY_DIAGNOSIS_DRAFT });
        setInvestigationDraft({ ...EMPTY_INVESTIGATION_DRAFT });
        setProcedureDraft({ ...EMPTY_PROCEDURE_DRAFT });
        setMedicationHistoryDraft({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
        setPrescriptionDraft({ ...EMPTY_PRESCRIPTION_DRAFT });
        setGlobalDays('');
        setReferralDraft({ location: '', speciality: '', doctor: '' });
        // Fetch full patient details for the info display
        if (selectedPatient?.patient_id) {
            setPatientDetailsLoading(true);
            try {
                const r = await getComprehensiveProfile(selectedPatient.patient_id);
                const { patient, mrd_entries } = r.data?.data || {};
                setPatientDetails(patient);
                if (patient?.dob) {
                    setForm(prev => ({ ...prev, age_group: deriveAgeGroup(patient.dob) }));
                }
                
                // Update clinical context from mrd_entries
                const vitals = (mrd_entries || []).filter(e => e.weight || e.height || e.temperature).map(e => ({
                    date: e.visit_date, weight: e.weight, height: e.height, temperature: e.temperature, pulse: e.pulse, spo2: e.spo2
                }));
                setClinicalContext({
                    vitals_history: vitals,
                    allergy_summary: [],
                    current_meds: [],
                    patient_history: mrd_entries || []
                });
            } catch (e) {
                console.error('Failed to fetch patient details for modal', e);
            } finally {
                setPatientDetailsLoading(false);
            }
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        const newAttachments = [...(form.attachments || [])];

        for (const file of files) {
            const isPdf = file.type === 'application/pdf';
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            newAttachments.push({
                base64,
                name: file.name,
                file_type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
                preview: isPdf ? null : base64 // Local preview only for images
            });
        }
        setForm({ ...form, attachments: newAttachments });
    };

    const removeAttachment = (index) => {
        const updated = [...form.attachments];
        updated.splice(index, 1);
        setForm({ ...form, attachments: updated });
    };

    const filteredRecords = records.filter(r => {
        if (filterType === 'CONSULTATION' && r.visit_type !== 'CONSULTATION') return false;
        if (filterType === 'VACCINATION' && r.visit_type !== 'VACCINATION') return false;
        if (keywordSearch) {
            const k = keywordSearch.toLowerCase();
            return r.diagnosis?.toLowerCase().includes(k) || r.chief_complaint?.toLowerCase().includes(k);
        }
        return true;
    });

    const prescriptionLines = selectedRecord?.prescription?.split('\n').filter(Boolean) || [];

    return (
        <div className="appointments-page-v4" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.4rem 0.85rem 0.75rem 0.5rem' }}>
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>E-prescription</h1>
                    <p>Doctor consultation workspace, clinical documentation & e-prescribing</p>
                </div>
                <div className="header-right-v4">
                    <button className="btn-header-v4" onClick={() => loadDirectory()}>
                        <RefreshCw size={16} className={dirLoading ? 'spinning' : ''} />
                        <span>Sync Directory</span>
                    </button>
                </div>
            </div>

            <div className="mrd-workspace-v3">
                {/* 1. Directory Panel */}
                <aside className="mrd-panel-v3 sidebar-panel">
                    {pendingCompletions.length > 0 && (
                        <div className="worklist-section">
                            <div className="panel-label" style={{ color: '#6366f1', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Pending clinical records</span>
                                <span className="badge">{pendingCompletions.length}</span>
                            </div>
                            <div className="worklist-container">
                                {pendingCompletions.map(a => (
                                    <div key={a.appointment_id} className="worklist-item" onClick={async () => {
                                        let p = patients.find(pat => pat.patient_id === a.patient_id);
                                        if (!p) {
                                            const res = await getPatientById(a.patient_id);
                                            p = res.data?.data;
                                        }
                                        if (p) selectPatientRecord(p, a);
                                    }}>
                                        <div className="dot"></div>
                                        <div className="wi-content">
                                            <div className="wi-name">{removeSalutation(a.child_name) || 'Unknown Patient'}</div>
                                            <div className="wi-meta">{fmt(a.appointment_date)} • {a.appointment_id}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="directory-search-container">
                        <div className="panel-label">Patient Directory</div>
                        <div className="search-bar-v3 sidebar-search">
                            <Search size={14} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                            />
                            {dirLoading && <RefreshCw size={12} className="spinning" />}
                        </div>
                    </div>
                    <div className="patient-list-v3">
                        {dirLoading && patients.length === 0 ? (
                            <div className="loading-state">
                                <RefreshCw size={24} className="spinning" />
                                <span>Loading Records...</span>
                            </div>
                        ) : patients.map(p => {
                            const isSelected = selectedPatient?.patient_id === p.patient_id;
                            const ini = initials(p);
                            return (
                                <div
                                    key={p.patient_id}
                                    className={`patient-card-group-v3 ${isSelected ? 'selected-group' : ''}`}
                                >
                                    <div
                                        className={`patient-item-v3 ${isSelected ? 'selected' : ''}`}
                                        onClick={() => selectPatientRecord(p)}
                                    >
                                        <div className="avatar" style={{ background: isSelected ? avatarColor(ini) : '#f1f5f9', color: isSelected ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={14} />
                                        </div>
                                        <div className="info">
                                            <div className="p-name">{pname(p)}</div>
                                            <div className="p-meta">{p.patient_id} • {age(p.dob) || 'No Age'}</div>
                                        </div>
                                        <div className="patient-actions-pill" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {isSelected && (
                                                <button
                                                    type="button"
                                                    className="btn-add-mini-inline"
                                                    title="Add Clinical Entry"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEntryModal();
                                                    }}
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            )}
                                            <ChevronDown size={14} className={`chevron-indicator ${isSelected ? 'rotated' : ''}`} />
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="patient-timeline-embedded">
                                            <div className="timeline-filters-mini">
                                                <div className="type-pills-mini">
                                                    {['ALL', 'CONSULTATION', 'VACCINATION'].map(type => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            className={filterType === type ? 'active' : ''}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFilterType(type);
                                                            }}
                                                        >
                                                            {type === 'ALL' ? `Total (${records.length})` : type === 'CONSULTATION' ? 'Clinic' : 'Immune'}
                                                        </button>
                                                    ))}
                                                </div>
                                                {records.length > 2 && (
                                                    <div className="keyword-search-mini">
                                                        <Search size={12} />
                                                        <input
                                                            type="text"
                                                            placeholder="Filter records..."
                                                            value={keywordSearch}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => setKeywordSearch(e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="records-timeline-embedded">
                                                {recLoading ? (
                                                    <div className="loading-state-mini">
                                                        <RefreshCw size={18} className="spinning" />
                                                        <span>Loading history...</span>
                                                    </div>
                                                ) : filteredRecords.length === 0 ? (
                                                    <div className="no-records-proper">
                                                        <div className="no-records-icon-box">
                                                            <FileText size={22} />
                                                        </div>
                                                        <div className="no-records-title">No records identified</div>
                                                        <p className="no-records-subtitle">No previous clinical records found for {pname(p)}</p>
                                                        <button
                                                            type="button"
                                                            className="btn-proper-start-entry"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openEntryModal();
                                                            }}
                                                        >
                                                            <Plus size={14} /> Start New Entry
                                                        </button>
                                                    </div>
                                                ) : filteredRecords.map((rec, i) => (
                                                    <div
                                                        key={rec._id || rec.appointment_id || i}
                                                        className={`record-card-v3 ${selectedRecord === rec && !showModal ? 'selected' : ''} ${rec.is_pending_record ? 'pending-state' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRecord(rec);
                                                            setShowModal(false);
                                                            setTab('details');
                                                        }}
                                                    >
                                                        <div className="record-header">
                                                            <span className="record-date">{fmt(rec.visit_date || rec.createdAt)}</span>
                                                            <span className={`type-tag ${rec.visit_type?.toLowerCase()}`}>{rec.visit_type}</span>
                                                        </div>
                                                        <div className="record-diagnosis">
                                                            {rec.is_pending_record && <Clock size={13} className="pending-icon" />}
                                                            <span>{rec.diagnosis || rec.vaccine_given || rec.chief_complaint || 'General Checkup'}</span>
                                                        </div>
                                                        <div className="record-footer">
                                                            <div className="doctor-pill"><Activity size={10} /> {rec.attending_doctor || 'Dr. Deepak'}</div>
                                                            {rec.prescription && <div className="attachment-pill"><Paperclip size={10} /> Rx</div>}
                                                            {rec.attachments?.length > 0 && <div className="attachment-pill" style={{ background: '#ecfdf5', color: '#059669' }}><Paperclip size={10} /> {rec.attachments.length} Img</div>}
                                                            {rec.is_pending_record && (
                                                                <button className="btn-record-now" onClick={(e) => { e.stopPropagation(); selectPatientRecord(selectedPatient, rec); }}>
                                                                    Complete <Plus size={10} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* 3. Detailed View Panel */}
                <main className="mrd-main-v3">
                    {showModal ? (
                        <div className="inline-entry-v3">
                            <header className="modal-header-v3" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff', padding: '1.25rem 2rem', borderRadius: '20px 20px 0 0', position: 'sticky', top: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: '#eef2ff', color: '#6366f1', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Clipboard size={22} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1e293b' }}>New Clinical Entry</h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Document patient visit and clinical observations</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn-header-v4"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                        onClick={() => setForm({
                                            ...EMPTY_ENTRY,
                                            patient_id: '26-HA6',
                                            visit_date: '2026-04-08',
                                            visit_type: 'CONSULTATION',
                                            attending_doctor: 'Dr. Deepak',
                                            diagnosis: 'Acute Upper Respiratory Infection',
                                            chief_complaint: 'Fever and Cough since 2 days',
                                            symptoms: 'Fever, Dry Cough, Nasal Congestion',
                                            weight: '12.5',
                                            temperature: '101',
                                            spo2: '98',
                                            pulse: '110',
                                            head_circumference: '48',
                                            prescription: 'Syp. Paracetamol 5ml - TDS - 3 days\nSyp. Ascoril LS 2.5ml - BD - 5 days',
                                            advice: 'Warm fluids, No cold water, Saline nasal drops PRN',
                                            clinical_notes: 'Throat congested, Chest clear on auscultation. No distress.'
                                        })}
                                    >
                                        <Zap size={14} />
                                        <span>Load Sample (Hafsa)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAsTemplate}
                                        className="btn-header-v4"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0f766e', color: '#fff', border: '1px solid #0f766e' }}
                                        title="Save current consultation entries as a reusable Clinical Template"
                                    >
                                        <BookmarkPlus size={14} />
                                        <span>Save as Template</span>
                                    </button>
                                    {selectedRecord && (
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="btn-header-v4"
                                            style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            title="View Selected Record Details"
                                        >
                                            <Eye size={14} />
                                            <span>View Record</span>
                                        </button>
                                    )}
                                    <button onClick={() => setShowModal(false)} className="close-btn" title="Close Entry Workspace"><X size={20} /></button>
                                </div>
                            </header>

                            <form onSubmit={handleAddEntry} className="entry-form-v3 custom-scrollbar" style={{ padding: 0 }}>
                                <div className="clinical-wizard-container">
                                    {/* ── Top Wizard Stepper Navigation ── */}
                                    <div className="wizard-nav-tabs">
                                        {[
                                            { step: 1, title: 'Patient Context', icon: <User size={15} />, desc: 'ID, Age & Safety' },
                                            { step: 2, title: 'Complaints & Vitals', icon: <Activity size={15} />, desc: 'Symptoms & Metrics' },
                                            { step: 3, title: 'Assessment & Exam', icon: <Stethoscope size={15} />, desc: 'Targeted Exam' },
                                            { step: 4, title: 'Diagnosis & Plan', icon: <FileText size={15} />, desc: 'ICD-10 & Tests' },
                                            { step: 5, title: 'Prescription & Advice', icon: <Pill size={15} />, desc: 'Rx & Care Plan' },
                                            { step: 6, title: 'Summary & Sign-Off', icon: <FileCheck size={15} />, desc: 'Review & Finalize' }
                                        ].map(tab => (
                                            <div
                                                key={tab.step}
                                                className={`wizard-tab-item ${activeStep === tab.step ? 'active' : activeStep > tab.step ? 'completed' : ''}`}
                                                onClick={() => setActiveStep(tab.step)}
                                            >
                                                <div className="wizard-tab-num">
                                                    {activeStep > tab.step ? <Check size={12} strokeWidth={3} /> : tab.step}
                                                </div>
                                                <div className="wizard-tab-text">
                                                    <div className="wizard-tab-title">{tab.title}</div>
                                                    <div className="wizard-tab-desc">{tab.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── 1-Click Clinical Templates Bar (from Clinical Templates) ── */}
                                    <div className="quick-template-bar">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#0f766e', minWidth: '155px' }}>
                                            <Sparkles size={14} /> 1-Click Templates:
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', flex: 1, paddingBottom: '2px', alignItems: 'center' }}>
                                            {templatesLoading ? (
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <RefreshCw size={12} className="spinning" /> Loading templates...
                                                </span>
                                            ) : (clinicalTemplates.length > 0 ? clinicalTemplates : Object.entries(QUICK_CLINICAL_TEMPLATES).map(([k, v]) => ({ ...v, _id: k }))).map(tmpl => {
                                                const icon = tmpl.metadata?.icon || tmpl.icon || (tmpl.type === 'advice' ? '💡' : tmpl.type === 'note' ? '📝' : '⚡');
                                                const badge = tmpl.metadata?.badge || tmpl.badge || (tmpl.type === 'condition' ? 'Condition' : tmpl.type === 'note' ? 'Note' : 'Care Advice');
                                                const title = tmpl.title || tmpl.name;
                                                return (
                                                    <button
                                                        key={tmpl._id || tmpl.id || title}
                                                        type="button"
                                                        className="quick-template-chip"
                                                        onClick={() => applyQuickTemplate(tmpl)}
                                                        title={`Click to auto-apply "${title}" from Clinical Templates`}
                                                    >
                                                        <span>{icon}</span>
                                                        <span>{title}</span>
                                                        <span style={{ fontSize: '0.62rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '8px', fontWeight: 700 }}>{badge}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSaveAsTemplate}
                                            style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: '8px', background: '#f0f9ff', border: '1px solid #bae6fd', cursor: 'pointer' }}
                                            title="Save current consultation data as a reusable Clinical Template"
                                        >
                                            <BookmarkPlus size={13} />
                                            <span>Save as Template</span>
                                        </button>
                                        <a
                                            href="#/templates"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: '0.74rem', color: '#0f766e', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: '8px', background: '#f0fdfa', border: '1px solid #ccfbf1' }}
                                            title="Open Clinical Templates page to add or customize templates"
                                        >
                                            <span>⚙️ Manage Templates</span>
                                        </a>
                                    </div>

                                    {/* ── STEP 1: PATIENT CONTEXT & SAFETY ── */}
                                    {activeStep === 1 && (
                                        <div className="wizard-step-content" style={{ padding: '1.25rem' }}>
                                            {/* Patient Summary Row with uneditable Age Group */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.1fr 0.8fr 1fr', gap: '1rem', marginBottom: '1.25rem', padding: '1.25rem', background: '#fcfdfe', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
                                                    {patientDetailsLoading ? (
                                                        <div style={{ height: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}><RefreshCw size={12} className="spinning" /></div>
                                                    ) : (
                                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem', marginTop: '2px' }}>
                                                            {patientDetails ? pname(patientDetails) || (patientDetails.full_name) || '—' : (selectedPatient ? pname(selectedPatient) : '—')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Age & DOB</label>
                                                    {patientDetailsLoading ? (
                                                        <div style={{ height: '24px', color: '#cbd5e1' }}><RefreshCw size={12} className="spinning" /></div>
                                                    ) : (
                                                        <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.88rem', marginTop: '2px' }}>
                                                            {age(patientDetails?.dob || selectedPatient?.dob) || '—'}
                                                            <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: '4px', fontSize: '0.75rem' }}>({fmt(patientDetails?.dob || selectedPatient?.dob)})</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Age Group / Demographic</label>
                                                    {(() => {
                                                        const ag = form.age_group || deriveAgeGroup(patientDetails?.dob || selectedPatient?.dob);
                                                        const cfg = AGE_GROUP_CONFIG[ag] || AGE_GROUP_CONFIG.Adult;
                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                                                <div
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        background: cfg.bg,
                                                                        color: cfg.color,
                                                                        border: `1px solid ${cfg.border}`,
                                                                        borderRadius: '20px',
                                                                        padding: '3px 10px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 800,
                                                                        letterSpacing: '0.01em',
                                                                        userSelect: 'none',
                                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                                    }}
                                                                    title="Demographic classification auto-derived from Patient DOB (Locked)"
                                                                >
                                                                    <span style={{ fontSize: '0.85rem' }}>{cfg.icon}</span>
                                                                    <span>{cfg.label}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gender</label>
                                                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.88rem', marginTop: '2px', textTransform: 'capitalize' }}>
                                                        {(patientDetails?.gender || selectedPatient?.gender) || '—'}
                                                    </div>
                                                </div>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact</label>
                                                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.88rem', marginTop: '2px' }}>
                                                        {(patientDetails?.wa_id || patientDetails?.parent_mobile || selectedPatient?.wa_id || selectedPatient?.parent_mobile) || '—'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Visit Info & Doctor */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Calendar size={16} /> Consultation Details
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '1rem' }}>
                                                    <div className="f-group-premium">
                                                        <label>Patient ID</label>
                                                        <input className="input-premium-v4" disabled value={form.patient_id} />
                                                    </div>
                                                    <div className="f-group-premium">
                                                        <label>Visit Date</label>
                                                        <input className="input-premium-v4" type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} required />
                                                    </div>
                                                    <div className="f-group-premium">
                                                        <label>Visit Type</label>
                                                        <select className="input-premium-v4" value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })}>
                                                            <option value="CONSULTATION">Consultation</option>
                                                            <option value="VACCINATION">Vaccination</option>
                                                            <option value="FOLLOW_UP">Follow-up</option>
                                                        </select>
                                                    </div>
                                                    <div className="f-group-premium">
                                                        <label>Attending Doctor</label>
                                                        <select className="input-premium-v4" value={form.attending_doctor} onChange={e => setForm({ ...form, attending_doctor: e.target.value })} required>
                                                            <option value="">Select Doctor</option>
                                                            {doctorsList.map(doc => <option key={doc._id} value={doc.name}>{doc.name}</option>)}
                                                            {form.attending_doctor && !doctorsList.find(d => d.name === form.attending_doctor) && (
                                                                <option value={form.attending_doctor}>{form.attending_doctor}</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Patient Safety & Allergies Card */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <AlertTriangle size={16} /> Patient Allergies & Drug Safety
                                                    </div>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', color: form.no_known_allergy ? '#0ea5e9' : '#64748b', userSelect: 'none' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!form.no_known_allergy}
                                                            onChange={e => setForm({ ...form, no_known_allergy: e.target.checked, allergies: e.target.checked ? [] : form.allergies })}
                                                            style={{ accentColor: '#0ea5e9', width: '16px', height: '16px' }}
                                                        />
                                                        No Known Allergies (NKDA)
                                                    </label>
                                                </div>

                                                {!form.no_known_allergy && (
                                                    <div>
                                                        {(form.allergies || []).length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                {form.allergies.map((al, idx) => (
                                                                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '4px 8px', fontSize: '0.8rem' }}>
                                                                        <span style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.65rem', textTransform: 'uppercase', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>{al.category}</span>
                                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{al.type}</span>
                                                                        {al.reaction && <span style={{ color: '#64748b' }}>({al.reaction})</span>}
                                                                        <button type="button" onClick={() => handleRemoveAllergyItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1.5fr 1fr 100px auto', gap: '0.6rem', alignItems: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                            <select className="input-premium-v4" value={allergyDraft.category} onChange={e => setAllergyDraft({ ...allergyDraft, category: e.target.value })}>
                                                                <option value="Drug">Drug</option>
                                                                <option value="Food">Food</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                            <input className="input-premium-v4" placeholder="Allergen name (e.g. Penicillin, Peanuts)" value={allergyDraft.type} list="allergy-options" onChange={e => setAllergyDraft({ ...allergyDraft, type: e.target.value })} />
                                                            <input className="input-premium-v4" placeholder="Reaction (e.g. Urticaria, Wheeze)" value={allergyDraft.reaction} onChange={e => setAllergyDraft({ ...allergyDraft, reaction: e.target.value })} />
                                                            <select className="input-premium-v4" value={allergyDraft.intensity} onChange={e => setAllergyDraft({ ...allergyDraft, intensity: e.target.value })}>
                                                                <option value="">Severity</option>
                                                                <option value="Mild">Mild</option>
                                                                <option value="Moderate">Moderate</option>
                                                                <option value="High">Severe</option>
                                                            </select>
                                                            <button type="button" onClick={handleAddAllergyItem} className="btn-save-v3" style={{ padding: '6px 14px', fontSize: '0.8rem', height: '36px' }}>+ Add</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Age-Specific Baseline Assessment Toolkits */}
                                            {(() => {
                                                const ag = form.age_group || deriveAgeGroup(patientDetails?.dob || selectedPatient?.dob);
                                                if (['Neonatal', 'Infant'].includes(ag)) {
                                                    return (
                                                        <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem', background: '#fdf2f8', border: '1px solid #fbcfe8' }}>
                                                            <div className="premium-header-v2">
                                                                <div className="title" style={{ color: '#db2777', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span>🍼 Neonatal & Infant Baseline Checklist</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                                                <div className="f-group-premium">
                                                                    <label>Birth Weight (kg)</label>
                                                                    <input className="input-premium-v4" placeholder="e.g. 3.1" value={form.neonatal_history?.birth_weight || ''} onChange={e => setForm({ ...form, neonatal_history: { ...(form.neonatal_history || {}), birth_weight: e.target.value } })} />
                                                                </div>
                                                                <div className="f-group-premium">
                                                                    <label>Gestational Age (wks)</label>
                                                                    <input className="input-premium-v4" placeholder="e.g. 38" value={form.neonatal_history?.gestational_age || ''} onChange={e => setForm({ ...form, neonatal_history: { ...(form.neonatal_history || {}), gestational_age: e.target.value } })} />
                                                                </div>
                                                                <div className="f-group-premium">
                                                                    <label>Feeding Type</label>
                                                                    <select className="input-premium-v4" value={form.neonatal_history?.feeding_type || 'Exclusive Breastfeeding'} onChange={e => setForm({ ...form, neonatal_history: { ...(form.neonatal_history || {}), feeding_type: e.target.value } })}>
                                                                        <option value="Exclusive Breastfeeding">Exclusive Breastfeeding</option>
                                                                        <option value="Formula Feeding">Formula Feeding</option>
                                                                        <option value="Mixed Feeding">Mixed Feeding</option>
                                                                        <option value="Weaning / Solids">Weaning / Solids</option>
                                                                    </select>
                                                                </div>
                                                                <div className="f-group-premium">
                                                                    <label>Anterior Fontanelle</label>
                                                                    <select className="input-premium-v4" value={form.neonatal_history?.anterior_fontanelle || 'Normal/Flat'} onChange={e => setForm({ ...form, neonatal_history: { ...(form.neonatal_history || {}), anterior_fontanelle: e.target.value } })}>
                                                                        <option value="Normal/Flat">Normal / Flat</option>
                                                                        <option value="Bulging (Raised ICP)">Bulging (Raised ICP)</option>
                                                                        <option value="Depressed (Dehydration)">Depressed (Dehydration)</option>
                                                                        <option value="Closed">Closed</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                if (ag === 'Pediatric') {
                                                    return (
                                                        <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                            <div className="premium-header-v2">
                                                                <div className="title" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span>🧒 Pediatric Growth & Milestones Check</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                                                <div className="f-group-premium">
                                                                    <label>Developmental Milestones</label>
                                                                    <select className="input-premium-v4" value={form.pediatric_assessment?.milestones || 'Age-Appropriate'} onChange={e => setForm({ ...form, pediatric_assessment: { ...(form.pediatric_assessment || {}), milestones: e.target.value } })}>
                                                                        <option value="Age-Appropriate">Age-Appropriate / Normal</option>
                                                                        <option value="Gross Motor Delay">Gross Motor Delay</option>
                                                                        <option value="Speech/Language Delay">Speech / Language Delay</option>
                                                                        <option value="Global Delay">Global Developmental Delay</option>
                                                                    </select>
                                                                </div>
                                                                <div className="f-group-premium">
                                                                    <label>Immunization Status</label>
                                                                    <select className="input-premium-v4" value={form.pediatric_assessment?.immunization_status || 'Up to Date (IAP)'} onChange={e => setForm({ ...form, pediatric_assessment: { ...(form.pediatric_assessment || {}), immunization_status: e.target.value } })}>
                                                                        <option value="Up to Date (IAP)">Up to Date (National / IAP)</option>
                                                                        <option value="Partially Vaccinated">Partially Vaccinated</option>
                                                                        <option value="Unvaccinated">Unvaccinated / Refused</option>
                                                                    </select>
                                                                </div>
                                                                <div className="f-group-premium">
                                                                    <label>School & Play Activity</label>
                                                                    <select className="input-premium-v4" value={form.pediatric_assessment?.school_activity || 'Active & Normal'} onChange={e => setForm({ ...form, pediatric_assessment: { ...(form.pediatric_assessment || {}), school_activity: e.target.value } })}>
                                                                        <option value="Active & Normal">Active & Attending School</option>
                                                                        <option value="Frequent Absenteeism">Frequent Absenteeism / Illness</option>
                                                                        <option value="Fatigue / Decreased Play">Fatigue / Decreased Play</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}

                                    {/* ── STEP 2: CHIEF COMPLAINTS & VITALS ── */}
                                    {activeStep === 2 && (
                                        <div className="wizard-step-content" style={{ padding: '1.25rem' }}>
                                            {/* Chief Complaints Card */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <MessageCircle size={16} /> Chief Complaints (Patient / Caregiver Words)
                                                    </div>
                                                </div>

                                                {/* 1-Click Quick Complaints Chips */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                                        1-Click Quick Symptoms:
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                                        {QUICK_COMPLAINT_CHIPS.map(chip => {
                                                            const isSelected = (form.chief_complaints_list || []).includes(chip);
                                                            return (
                                                                <button
                                                                    key={chip}
                                                                    type="button"
                                                                    className={`quick-action-chip ${isSelected ? 'active' : ''}`}
                                                                    onClick={() => handleToggleComplaintChip(chip)}
                                                                >
                                                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                                                    {chip}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label>Primary Complaint & Duration</label>
                                                        <input
                                                            className="input-premium-v4"
                                                            placeholder="e.g. High grade fever x 3 days, cough with phlegm"
                                                            value={form.chief_complaint}
                                                            onChange={e => setForm({ ...form, chief_complaint: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label>Associated Symptoms (comma-separated)</label>
                                                        <input
                                                            className="input-premium-v4"
                                                            placeholder="e.g. Vomiting, Rhinorrhea, Reduced appetite"
                                                            value={form.symptoms}
                                                            onChange={e => setForm({ ...form, symptoms: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dense Vitals Grid */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Activity size={16} /> Objective Vitals & Anthropometrics
                                                    </div>
                                                    {clinicalContext.vitals_history.length > 0 && (
                                                        <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 700 }}>
                                                            Last Visit: Wt {clinicalContext.vitals_history[0].weight || '-'} kg • Ht {clinicalContext.vitals_history[0].height || '-'} cm • Temp {clinicalContext.vitals_history[0].temperature || '-'} °F
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
                                                    {/* Weight */}
                                                    <div className="vital-input-v4">
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Weight (kg)</span>
                                                            <span style={{ color: '#16a34a', fontSize: '0.6rem', fontWeight: 800 }}>Rx DOSING</span>
                                                        </label>
                                                        <input placeholder="0.0" value={form.weight} onChange={e => { const w = e.target.value; setForm({ ...form, weight: w, bmi: calcBMI(w, form.height) }); }} />
                                                    </div>

                                                    {/* Height */}
                                                    <div className="vital-input-v4">
                                                        <label>Height / Length (cm)</label>
                                                        <input placeholder="0" value={form.height} onChange={e => { const h = e.target.value; setForm({ ...form, height: h, bmi: calcBMI(form.weight, h) }); }} />
                                                    </div>

                                                    {/* BMI Auto */}
                                                    <div className="vital-input-v4" style={{ background: '#f8faff', borderStyle: 'dashed' }}>
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>BMI</span>
                                                            <span style={{ color: '#6366f1', fontSize: '0.6rem', fontWeight: 800 }}>AUTO</span>
                                                        </label>
                                                        <input placeholder="—" value={form.bmi} readOnly style={{ color: '#6366f1', fontWeight: 800 }} />
                                                    </div>

                                                    {/* Head Circumference */}
                                                    <div className="vital-input-v4">
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Head Cir. (cm)</span>
                                                            <span style={{ color: '#0ea5e9', fontSize: '0.6rem', fontWeight: 700 }}>PEDS</span>
                                                        </label>
                                                        <input placeholder="0" value={form.head_circumference} onChange={e => setForm({ ...form, head_circumference: e.target.value })} />
                                                    </div>

                                                    {/* Temperature */}
                                                    <div className="vital-input-v4" style={{ borderLeft: (parseFloat(form.temperature) >= 100.4) ? '3px solid #ef4444' : '3px solid #cbd5e1' }}>
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Temp (°F)</span>
                                                            <span style={{ fontSize: '0.58rem', color: '#64748b' }}>Normal: 98.6</span>
                                                        </label>
                                                        <input placeholder="98.6" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} />
                                                    </div>

                                                    {/* Pulse */}
                                                    <div className="vital-input-v4" style={{ borderLeft: '3px solid #ef4444' }}>
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Pulse (bpm)</span>
                                                            <span style={{ fontSize: '0.58rem', color: '#64748b' }}>70-110</span>
                                                        </label>
                                                        <input placeholder="80" value={form.pulse} onChange={e => setForm({ ...form, pulse: e.target.value })} />
                                                    </div>

                                                    {/* SpO2 */}
                                                    <div className="vital-input-v4" style={{ borderLeft: (parseFloat(form.spo2) && parseFloat(form.spo2) < 95) ? '3px solid #dc2626' : '3px solid #3b82f6' }}>
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>SpO2 (%)</span>
                                                            <span style={{ fontSize: '0.58rem', color: '#64748b' }}>≥95%</span>
                                                        </label>
                                                        <input placeholder="98" value={form.spo2} onChange={e => setForm({ ...form, spo2: e.target.value })} />
                                                    </div>

                                                    {/* Blood Pressure */}
                                                    <div className="vital-input-v4">
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Blood Pressure</span>
                                                            <span style={{ fontSize: '0.58rem', color: '#64748b' }}>mm/Hg</span>
                                                        </label>
                                                        <input placeholder="110/70" value={form.bp} onChange={e => setForm({ ...form, bp: e.target.value })} />
                                                    </div>

                                                    {/* Respiration */}
                                                    <div className="vital-input-v4">
                                                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Respiration</span>
                                                            <span style={{ fontSize: '0.58rem', color: '#64748b' }}>b/min</span>
                                                        </label>
                                                        <input placeholder="20" value={form.respiration} onChange={e => setForm({ ...form, respiration: e.target.value })} />
                                                    </div>

                                                    {/* Random Sugar */}
                                                    <div className="vital-input-v4">
                                                        <label>Random Sugar (mg/dL)</label>
                                                        <input placeholder="e.g. 95" value={form.random_sugar} onChange={e => setForm({ ...form, random_sugar: e.target.value })} />
                                                    </div>

                                                    {/* Pain Score */}
                                                    <div className="vital-input-v4">
                                                        <label>Pain Score (0-10)</label>
                                                        <select className="input-premium-v4" style={{ border: 'none', padding: '2px 0' }} value={form.pain_score} onChange={e => setForm({ ...form, pain_score: e.target.value })}>
                                                            <option value="">No Pain (0)</option>
                                                            <option value="1">1 - Very Mild</option>
                                                            <option value="2">2 - Discomfort</option>
                                                            <option value="4">4 - Distressing</option>
                                                            <option value="6">6 - Severe</option>
                                                            <option value="8">8 - Intense</option>
                                                            <option value="10">10 - Worst</option>
                                                        </select>
                                                    </div>

                                                    {/* Fall Risk */}
                                                    <div className="vital-input-v4">
                                                        <label>Fall Risk</label>
                                                        <select className="input-premium-v4" style={{ border: 'none', padding: '2px 0' }} value={form.fall_risk} onChange={e => setForm({ ...form, fall_risk: e.target.value })}>
                                                            <option value="Low">Low Risk</option>
                                                            <option value="Moderate">Moderate Risk</option>
                                                            <option value="High">High Risk</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── STEP 3: ASSESSMENT & TARGETED EXAM ── */}
                                    {activeStep === 3 && (
                                        <div className="wizard-step-content" style={{ padding: '1.25rem' }}>
                                            {/* Structured HPI */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Clipboard size={16} /> History of Present Illness (HPI)
                                                    </div>
                                                </div>
                                                <textarea
                                                    className="input-premium-v4"
                                                    rows={3}
                                                    placeholder="Chronological narrative of onset, duration, nature of symptoms, aggravating/relieving factors, previous medications taken, hydration and sleep status..."
                                                    value={form.history_of_present_illness}
                                                    onChange={e => setForm({ ...form, history_of_present_illness: e.target.value })}
                                                />
                                            </div>

                                            {/* Targeted Physical Examination (Normal = Skip) */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Stethoscope size={16} /> Targeted Physical Examination
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleSetNormalExam}
                                                        className="btn-header-v4"
                                                        style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.78rem', fontWeight: 800, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    >
                                                        <CheckCircle2 size={14} /> 1-Click: Mark All Exam as Normal
                                                    </button>
                                                </div>

                                                {/* General Examination Checklist Buttons */}
                                                <div style={{ marginBottom: '1.25rem' }}>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                                                        General Signs (Click to toggle abnormal findings):
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                                                        {[
                                                            { key: 'pe_pallor', label: 'Pallor', val: form.pe_pallor },
                                                            { key: 'pe_icterus', label: 'Icterus', val: form.pe_icterus },
                                                            { key: 'pe_oedema', label: 'Oedema', val: form.pe_oedema },
                                                            { key: 'pe_cyanosis', label: 'Cyanosis', val: form.pe_cyanosis },
                                                            { key: 'pe_clubbing', label: 'Clubbing', val: form.pe_clubbing },
                                                            { key: 'pe_lymphadenopathy', label: 'Lymph Nodes', val: form.pe_lymphadenopathy }
                                                        ].map(item => {
                                                            const isAbnormal = item.val && item.val !== 'Absent';
                                                            return (
                                                                <button
                                                                    key={item.key}
                                                                    type="button"
                                                                    className={`exam-finding-btn ${isAbnormal ? 'abnormal' : item.val === 'Absent' ? 'normal' : ''}`}
                                                                    onClick={() => setForm({ ...form, [item.key]: isAbnormal ? 'Absent' : 'Present' })}
                                                                >
                                                                    <div>{item.label}</div>
                                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                                                                        {item.val || 'Normal'}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Targeted Systemic Exam Text */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <label style={{ margin: 0 }}>General Physical Findings</label>
                                                            <button
                                                                type="button"
                                                                style={{ border: 'none', background: 'none', color: '#0ea5e9', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                                                                onClick={() => setForm({ ...form, physical_examination: 'Active, alert, hydrated. Throat clear, tonsils normal. No stridor.' })}
                                                            >
                                                                + Quick Normal
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            className="input-premium-v4"
                                                            rows={3}
                                                            placeholder="Throat, tonsils, ear drums, skin rash, lymph nodes..."
                                                            value={form.physical_examination}
                                                            onChange={e => setForm({ ...form, physical_examination: e.target.value })}
                                                        />
                                                    </div>

                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <label style={{ margin: 0 }}>Systemic Examination (Chest, CVS, P/A, CNS)</label>
                                                            <button
                                                                type="button"
                                                                style={{ border: 'none', background: 'none', color: '#0ea5e9', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                                                                onClick={() => setForm({ ...form, systemic_examination: 'Chest: Clear b/l, no wheeze. CVS: S1 S2 normal. P/A: Soft, non-tender. CNS: Conscious, alert.' })}
                                                            >
                                                                + Quick Normal
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            className="input-premium-v4"
                                                            rows={3}
                                                            placeholder="Chest: Air entry, wheeze, crackles. CVS: S1 S2, murmur. Abdomen: Tenderness, organomegaly. CNS: Tone, reflexes..."
                                                            value={form.systemic_examination}
                                                            onChange={e => setForm({ ...form, systemic_examination: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── STEP 4: DIAGNOSIS & PLAN ── */}
                                    {activeStep === 4 && (
                                        <div className="wizard-step-content" style={{ padding: '1.25rem' }}>
                                            {/* Diagnoses Card */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FileText size={16} /> Provisional & Confirmed Diagnoses
                                                    </div>
                                                </div>

                                                {(form.provisional_diagnoses || []).length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                                        {form.provisional_diagnoses.map((diag, idx) => (
                                                            <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem' }}>
                                                                <span style={{ fontWeight: 800, color: '#0f766e' }}>{diag.diagnosis_name || diag.diagnosis}</span>
                                                                {diag.icd_10 && <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>{diag.icd_10}</span>}
                                                                {diag.severity && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({diag.severity})</span>}
                                                                <button type="button" onClick={() => handleRemoveDiagnosisItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Add Diagnosis Row */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 120px 100px auto', gap: '0.6rem', alignItems: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <input className="input-premium-v4" placeholder="Search or type diagnosis (e.g. Acute Bronchiolitis)" value={diagnosisDraft.diagnosis_name} list="icd10-options" onChange={e => {
                                                        const val = e.target.value;
                                                        const matched = masterData.icd10.find(i => i.name.toLowerCase() === val.toLowerCase());
                                                        setDiagnosisDraft({ ...diagnosisDraft, diagnosis_name: val, icd_10: matched ? (matched.code || '') : diagnosisDraft.icd_10 });
                                                    }} />
                                                    <input className="input-premium-v4" placeholder="ICD-10" value={diagnosisDraft.icd_10} onChange={e => setDiagnosisDraft({ ...diagnosisDraft, icd_10: e.target.value })} />
                                                    <select className="input-premium-v4" value={diagnosisDraft.stage} onChange={e => setDiagnosisDraft({ ...diagnosisDraft, stage: e.target.value })}>
                                                        <option value="Provisional">Provisional</option>
                                                        <option value="Confirmed">Confirmed</option>
                                                        <option value="Differential">Differential</option>
                                                    </select>
                                                    <select className="input-premium-v4" value={diagnosisDraft.severity} onChange={e => setDiagnosisDraft({ ...diagnosisDraft, severity: e.target.value })}>
                                                        <option value="Mild">Mild</option>
                                                        <option value="Moderate">Moderate</option>
                                                        <option value="Severe">Severe</option>
                                                    </select>
                                                    <button type="button" onClick={handleAddDiagnosisItem} className="btn-save-v3" style={{ padding: '6px 14px', fontSize: '0.8rem', height: '36px' }}>+ Add</button>
                                                </div>
                                            </div>

                                            {/* Investigations Advised */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Activity size={16} /> Investigations & Lab Orders
                                                    </div>
                                                </div>

                                                {/* 1-Click Investigation Chips */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                                        1-Click Lab Test Presets:
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                                        {QUICK_INVESTIGATION_CHIPS.map(chip => (
                                                            <button
                                                                key={chip}
                                                                type="button"
                                                                className="quick-action-chip"
                                                                onClick={() => handleAddInvestigationItem(chip)}
                                                            >
                                                                + {chip}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {(form.investigations_list || []).length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                                        {form.investigations_list.map((inv, idx) => (
                                                            <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '5px 10px', fontSize: '0.8rem' }}>
                                                                <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{inv.name || inv.test_name}</span>
                                                                <span style={{ fontSize: '0.68rem', color: '#2563eb', background: '#dbeafe', padding: '1px 5px', borderRadius: '4px' }}>{inv.timeframe || inv.priority}</span>
                                                                <button type="button" onClick={() => handleRemoveInvestigationItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Add Custom Test */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 1.5fr auto', gap: '0.6rem', alignItems: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <input className="input-premium-v4" placeholder="Type custom investigation name..." value={investigationDraft.name} list="investigation-options" onChange={e => setInvestigationDraft({ ...investigationDraft, name: e.target.value })} />
                                                    <select className="input-premium-v4" value={investigationDraft.priority} onChange={e => setInvestigationDraft({ ...investigationDraft, priority: e.target.value })}>
                                                        <option value="Routine">Routine</option>
                                                        <option value="Urgent">Urgent</option>
                                                        <option value="Stat">Stat / Immediate</option>
                                                    </select>
                                                    <input className="input-premium-v4" placeholder="Clinical indication..." value={investigationDraft.indication} onChange={e => setInvestigationDraft({ ...investigationDraft, indication: e.target.value })} />
                                                    <button type="button" onClick={() => handleAddInvestigationItem()} className="btn-save-v3" style={{ padding: '6px 14px', fontSize: '0.8rem', height: '36px' }}>+ Add</button>
                                                </div>
                                            </div>

                                            {/* Procedures Advised */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Zap size={16} /> Clinical Procedures Advised
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.75rem' }}>
                                                    {QUICK_PROCEDURE_CHIPS.map(chip => (
                                                        <button
                                                            key={chip}
                                                            type="button"
                                                            className="quick-action-chip"
                                                            onClick={() => handleAddProcedureItem(chip)}
                                                        >
                                                            + {chip}
                                                        </button>
                                                    ))}
                                                </div>

                                                {(form.procedures_list || []).length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {form.procedures_list.map((proc, idx) => (
                                                            <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '5px 10px', fontSize: '0.8rem' }}>
                                                                <span style={{ fontWeight: 700, color: '#6d28d9' }}>{proc.name}</span>
                                                                <button type="button" onClick={() => handleRemoveProcedureItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── STEP 5: PRESCRIPTION & STRUCTURED ADVICE ── */}
                                    {activeStep === 5 && (
                                        <div className="wizard-step-content" style={{ padding: '1.25rem' }}>
                                            {/* Structured Prescription Builder */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Pill size={16} /> Rx - Medication Prescriptions
                                                    </div>
                                                    {form.weight && (
                                                        <div style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                                            Weight: {form.weight} kg (Paracetamol 15mg/kg = {(parseFloat(form.weight) * 15).toFixed(0)} mg)
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Prescriptions Table */}
                                                {(form.prescriptions_list || []).length > 0 && (
                                                    <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                                                    <th style={{ padding: '8px' }}>Medicine & Form</th>
                                                                    <th style={{ padding: '8px' }}>Schedule & Route</th>
                                                                    <th style={{ padding: '8px' }}>Days</th>
                                                                    <th style={{ padding: '8px' }}>Instructions</th>
                                                                    <th style={{ padding: '8px', width: '40px' }}></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {form.prescriptions_list.map((rx, idx) => (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '8px' }}>
                                                                            <strong style={{ color: '#0f766e' }}>{rx.medicine}</strong>
                                                                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px' }}>{rx.dosage_form}</span>
                                                                        </td>
                                                                        <td style={{ padding: '8px' }}>
                                                                            <strong>{rx.schedule || '—'}</strong>
                                                                            <span style={{ marginLeft: '4px', fontSize: '0.72rem', color: '#64748b' }}>({rx.route || 'ORAL'})</span>
                                                                        </td>
                                                                        <td style={{ padding: '8px' }}>{rx.days ? `${rx.days} d` : '—'}</td>
                                                                        <td style={{ padding: '8px', color: '#475569' }}>{rx.instruction || rx.special_instructions || '—'}</td>
                                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                            <button type="button" onClick={() => handleRemovePrescriptionItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {/* Add Prescription Row */}
                                                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 1.5fr 90px 70px', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                                        <input className="input-premium-v4" placeholder="Medicine name (e.g. Syrup Paracetamol)" value={prescriptionDraft.medicine} list="medicine-options" onChange={e => setPrescriptionDraft({ ...prescriptionDraft, medicine: e.target.value })} />
                                                        <select className="input-premium-v4" value={prescriptionDraft.dosage_form} onChange={e => setPrescriptionDraft({ ...prescriptionDraft, dosage_form: e.target.value })}>
                                                            <option value="Syrup">Syrup</option>
                                                            <option value="Drops">Drops</option>
                                                            <option value="Tablet">Tablet</option>
                                                            <option value="Capsule">Capsule</option>
                                                            <option value="Inhaler">Inhaler</option>
                                                            <option value="Suspension">Suspension</option>
                                                            <option value="Ointment">Ointment</option>
                                                            <option value="Injection">Injection</option>
                                                        </select>
                                                        <select className="input-premium-v4" value={prescriptionDraft.schedule} onChange={e => setPrescriptionDraft({ ...prescriptionDraft, schedule: e.target.value })}>
                                                            <option value="">Schedule</option>
                                                            <option value="OD (Once daily)">OD (Once daily)</option>
                                                            <option value="BD (Twice daily)">BD (Twice daily)</option>
                                                            <option value="TID (Thrice daily)">TID (Thrice daily)</option>
                                                            <option value="QID (Four times daily)">QID (Four times daily)</option>
                                                            <option value="SOS (As needed)">SOS (As needed)</option>
                                                            <option value="Stat (Immediate)">Stat (Immediate)</option>
                                                        </select>
                                                        <select className="input-premium-v4" value={prescriptionDraft.route} onChange={e => setPrescriptionDraft({ ...prescriptionDraft, route: e.target.value })}>
                                                            <option value="ORAL">Oral</option>
                                                            <option value="NASAL">Nasal</option>
                                                            <option value="INHALATION">Inhalation</option>
                                                            <option value="TOPICAL">Topical</option>
                                                            <option value="IV">IV</option>
                                                            <option value="IM">IM</option>
                                                        </select>
                                                        <input className="input-premium-v4" placeholder="Days" value={prescriptionDraft.days} onChange={e => setPrescriptionDraft({ ...prescriptionDraft, days: e.target.value })} />
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '0.6rem', alignItems: 'center' }}>
                                                        <input className="input-premium-v4" placeholder="Timing (e.g. After food, At bedtime)" value={prescriptionDraft.instruction} onChange={e => setPrescriptionDraft({ ...prescriptionDraft, instruction: e.target.value })} />
                                                        <input className="input-premium-v4" placeholder="Special note / dose (e.g. 5ml each dose, shake well)" value={prescriptionDraft.special_instructions} onChange={e => setPrescriptionDraft({ ...prescriptionDraft, special_instructions: e.target.value })} />
                                                        <button type="button" onClick={() => handleAddPrescriptionItem()} className="btn-save-v3" style={{ padding: '6px 16px', fontSize: '0.82rem', height: '36px' }}>+ Add Rx</button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Structured Patient Advice */}
                                            <div className="form-card-premium" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                                                <div className="premium-header-v2">
                                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Shield size={16} /> Patient Advice & Care Plan
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                    {/* Home Care */}
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label>Home Care & Symptom Management</label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
                                                            {QUICK_ADVICE_CHIPS.homeCare.map((c, i) => (
                                                                <button key={i} type="button" className="quick-action-chip" style={{ fontSize: '0.68rem', padding: '2px 7px' }} onClick={() => setForm(prev => ({ ...prev, advice_home_care: prev.advice_home_care ? `${prev.advice_home_care}, ${c}` : c }))}>
                                                                    + {c.slice(0, 24)}...
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <textarea className="input-premium-v4" rows={3} placeholder="Rest, hydration, steam inhalation, comfort measures..." value={form.advice_home_care} onChange={e => setForm({ ...form, advice_home_care: e.target.value })} />
                                                    </div>

                                                    {/* Diet Advice */}
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label>Dietary & Feeding Plan</label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
                                                            {QUICK_ADVICE_CHIPS.diet.map((c, i) => (
                                                                <button key={i} type="button" className="quick-action-chip" style={{ fontSize: '0.68rem', padding: '2px 7px' }} onClick={() => setForm(prev => ({ ...prev, advice_diet: prev.advice_diet ? `${prev.advice_diet}, ${c}` : c }))}>
                                                                    + {c.slice(0, 24)}...
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <textarea className="input-premium-v4" rows={3} placeholder="Khichdi, curd, ORS, avoid oily/spicy foods, breastfeed on demand..." value={form.advice_diet} onChange={e => setForm({ ...form, advice_diet: e.target.value })} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                                                    {/* Warning Signs */}
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label style={{ color: '#dc2626', fontWeight: 800 }}>Urgent Warning Signs & Red Flags</label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
                                                            {QUICK_ADVICE_CHIPS.warningSigns.map((c, i) => (
                                                                <button key={i} type="button" className="quick-action-chip" style={{ fontSize: '0.68rem', padding: '2px 7px', color: '#b91c1c' }} onClick={() => setForm(prev => ({ ...prev, advice_warning_signs: prev.advice_warning_signs ? `${prev.advice_warning_signs}, ${c}` : c }))}>
                                                                    + {c.slice(0, 24)}...
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <textarea className="input-premium-v4" rows={2} placeholder="High fever persisting, breathing difficulty, lethargy, persistent vomiting..." value={form.advice_warning_signs} onChange={e => setForm({ ...form, advice_warning_signs: e.target.value })} />
                                                    </div>

                                                    {/* Follow-up / Next Visit */}
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label>Next Visit / Follow-up Due</label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
                                                            {['2 Days', '3 Days', '5 Days', '1 Week', '2 Weeks', '1 Month'].map(dur => (
                                                                <button key={dur} type="button" className={`quick-action-chip ${form.next_visit_due === dur ? 'active' : ''}`} style={{ fontSize: '0.7rem' }} onClick={() => setForm({ ...form, next_visit_due: dur })}>
                                                                    {dur}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <input className="input-premium-v4" placeholder="e.g. 3 days or YYYY-MM-DD" value={form.next_visit_due} onChange={e => setForm({ ...form, next_visit_due: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── STEP 6: SUMMARY & SIGN-OFF ── */}
                                    {activeStep === 6 && (
                                        <div className="wizard-step-content" style={{ padding: '1.25rem' }}>
                                            {/* Completeness Bar */}
                                            {(() => {
                                                const checks = [
                                                    { name: 'Patient & Visit Details', ok: Boolean(form.patient_id && form.visit_date) },
                                                    { name: 'Complaints or Vitals', ok: Boolean(form.chief_complaint || form.temperature || form.weight) },
                                                    { name: 'Assessment & Exam', ok: Boolean(form.history_of_present_illness || form.physical_examination || form.pe_pallor) },
                                                    { name: 'Provisional Diagnosis', ok: Boolean((form.provisional_diagnoses && form.provisional_diagnoses.length > 0) || diagnosisDraft.diagnosis_name) },
                                                    { name: 'Prescription or Advice', ok: Boolean((form.prescriptions_list && form.prescriptions_list.length > 0) || prescriptionDraft.medicine || form.advice_home_care || form.advice_diet) },
                                                    { name: 'Follow-up Set', ok: Boolean(form.next_visit_due) }
                                                ];
                                                const passed = checks.filter(c => c.ok).length;
                                                const pct = Math.round((passed / checks.length) * 100);

                                                return (
                                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                                                                Consultation Documentation Completeness: {pct}%
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: pct >= 80 ? '#16a34a' : '#ea580c' }}>
                                                                {passed} of {checks.length} Sections Completed
                                                            </div>
                                                        </div>
                                                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease' }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Consultation Summary Card */}
                                            <div className="consultation-summary-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f766e', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f766e', fontWeight: 800 }}>
                                                            Consultation Summary: {patientDetails ? pname(patientDetails) || (patientDetails.full_name) : (selectedPatient ? pname(selectedPatient) : 'Patient')}
                                                        </h4>
                                                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                            {age(patientDetails?.dob || selectedPatient?.dob)} • {patientDetails?.gender || selectedPatient?.gender} • ID: {form.patient_id} • Dr: {form.attending_doctor}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                            {form.visit_type} ({form.visit_date})
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Vitals Ribbon */}
                                                {(form.weight || form.temperature || form.pulse || form.spo2 || form.bp) && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', background: '#f8fafc', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.8rem' }}>
                                                        {form.weight && <span><strong>Weight:</strong> {form.weight} kg</span>}
                                                        {form.height && <span><strong>Height:</strong> {form.height} cm</span>}
                                                        {form.bmi && <span><strong>BMI:</strong> {form.bmi}</span>}
                                                        {form.temperature && <span><strong>Temp:</strong> {form.temperature} °F</span>}
                                                        {form.pulse && <span><strong>Pulse:</strong> {form.pulse} bpm</span>}
                                                        {form.spo2 && <span><strong>SpO2:</strong> {form.spo2}%</span>}
                                                        {form.bp && <span><strong>BP:</strong> {form.bp}</span>}
                                                    </div>
                                                )}

                                                {/* Complaints & HPI */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase' }}>Chief Complaints & HPI:</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#1e293b', marginTop: '2px' }}>
                                                        <strong>{form.chief_complaint || 'No complaint specified'}</strong>
                                                        {form.history_of_present_illness && <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '0.82rem' }}>{form.history_of_present_illness}</p>}
                                                    </div>
                                                </div>

                                                {/* Diagnoses */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase' }}>Diagnoses:</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                        {(form.provisional_diagnoses || []).length > 0 ? (
                                                            form.provisional_diagnoses.map((d, i) => (
                                                                <span key={i} style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                    {d.diagnosis_name || d.diagnosis} {d.icd_10 && `(${d.icd_10})`}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No structured diagnosis added.</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Prescriptions List */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase' }}>Prescription (Rx):</div>
                                                    {(form.prescriptions_list || []).length > 0 ? (
                                                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '0.82rem', color: '#1e293b' }}>
                                                            {form.prescriptions_list.map((rx, i) => (
                                                                <li key={i} style={{ marginBottom: '3px' }}>
                                                                    <strong>{rx.medicine}</strong> ({rx.dosage_form}) - {rx.schedule} x {rx.days || '—'} days {rx.instruction && `[${rx.instruction}]`}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No medications prescribed.</span>
                                                    )}
                                                </div>

                                                {/* Advice & Warning Signs */}
                                                {(form.advice_home_care || form.advice_diet || form.advice_warning_signs || form.next_visit_due) && (
                                                    <div style={{ background: '#fcfdfe', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                                                        {form.advice_home_care && <div><strong>Care Advice:</strong> {form.advice_home_care}</div>}
                                                        {form.advice_diet && <div style={{ marginTop: '3px' }}><strong>Diet:</strong> {form.advice_diet}</div>}
                                                        {form.advice_warning_signs && <div style={{ marginTop: '3px', color: '#dc2626' }}><strong>Warning Signs:</strong> {form.advice_warning_signs}</div>}
                                                        {form.next_visit_due && <div style={{ marginTop: '3px', color: '#0f766e', fontWeight: 700 }}><strong>Follow-up:</strong> {form.next_visit_due}</div>}
                                                    </div>
                                                )}
                                            </div>

                                            {/* File Attachments */}
                                            <div className="form-card-premium" style={{ marginBottom: '1rem', padding: '1rem' }}>
                                                <div className="premium-header-v2" style={{ marginBottom: '0.5rem' }}>
                                                    <div className="title" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Paperclip size={14} /> Clinical Attachments & Lab Reports
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                                    {(form.attachments || []).map((att, idx) => (
                                                        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                                                            <span>📄 {att.name || `Attachment ${idx + 1}`}</span>
                                                            <button type="button" onClick={() => removeAttachment(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={12} /></button>
                                                        </div>
                                                    ))}
                                                    <label className="att-upload-btn-premium" style={{ height: '34px', padding: '0 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                        <Plus size={14} /> Attach Report / Photo
                                                        <input type="file" multiple accept="image/*,.pdf,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <datalist id="chief-complaints-options">
                                    {masterData.complaints.map((item, idx) => <option key={`cc-${idx}`} value={item.name} />)}
                                </datalist>
                                <datalist id="allergy-options">
                                    {masterData.allergies.map((item, idx) => <option key={`allergy-${idx}`} value={item.name} />)}
                                </datalist>
                                <datalist id="icd10-options">
                                    {masterData.icd10.map((item, idx) => <option key={`icd-${idx}`} value={item.name}>{item.code}</option>)}
                                </datalist>
                                <datalist id="investigation-options">
                                    {masterData.investigations.map((item, idx) => <option key={`inv-${idx}`} value={item.name} />)}
                                </datalist>
                                <datalist id="procedure-options">
                                    {masterData.procedures.map((item, idx) => <option key={`proc-${idx}`} value={item.name} />)}
                                </datalist>
                                <datalist id="medicine-options">
                                    {masterData.medicines.map((item, idx) => <option key={`med-${idx}`} value={item.name} />)}
                                </datalist>
                                {formStatus.error && <p className="error-msg" style={{ margin: '1rem' }}>{formStatus.error}</p>}
                                {formStatus.success && <p className="success-msg" style={{ margin: '1rem' }}>{formStatus.success}</p>}
                            </form>

                            <footer className="modal-footer-v3" style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', padding: '0.85rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 20px 20px', position: 'sticky', bottom: 0, zIndex: 20, boxShadow: '0 -2px 10px rgba(0,0,0,0.02)' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn-wizard-discard"
                                    title="Discard and close consultation"
                                >
                                    <X size={15} />
                                    <span>Discard</span>
                                </button>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: '#64748b', fontWeight: 700, background: '#f8fafc', padding: '6px 14px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                                    <span>Step {activeStep} of 6</span>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        {[1, 2, 3, 4, 5, 6].map(s => (
                                            <div
                                                key={s}
                                                style={{
                                                    width: activeStep === s ? '18px' : '7px',
                                                    height: '7px',
                                                    borderRadius: '4px',
                                                    background: activeStep === s ? '#0f766e' : activeStep > s ? '#10b981' : '#cbd5e1',
                                                    transition: 'all 0.25s ease',
                                                    cursor: 'pointer'
                                                }}
                                                title={`Go to Step ${s}`}
                                                onClick={() => setActiveStep(s)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {activeStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveStep(s => Math.max(1, s - 1))}
                                            className="btn-wizard-prev"
                                        >
                                            <ChevronLeft size={16} />
                                            <span>Previous</span>
                                        </button>
                                    )}
                                    {activeStep < 6 ? (
                                        <button
                                            type="button"
                                            onClick={() => setActiveStep(s => Math.min(6, s + 1))}
                                            className="btn-wizard-next"
                                        >
                                            <span>Next Step</span>
                                            <ChevronRight size={16} />
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleSaveAsTemplate}
                                                className="btn-wizard-prev"
                                                style={{ borderColor: '#0f766e', color: '#0f766e', background: '#f0fdfa' }}
                                                title="Save current consultation data as reusable Clinical Template"
                                            >
                                                <BookmarkPlus size={15} />
                                                <span>Save as Template</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleAddEntry}
                                                className="btn-wizard-finalize"
                                                disabled={saving}
                                            >
                                            {saving ? (
                                                <>
                                                    <RefreshCw size={16} className="spinning" />
                                                    <span>Finalizing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={18} />
                                                    <span>Sign & Finalize Entry</span>
                                                </>
                                            )}
                                        </button>
                                        </>
                                    )}
                                </div>
                            </footer>
                        </div>
                    ) : !selectedRecord ? (
                        selectedPatient ? (
                            <div className="patient-workspace-overview">
                                <div className="overview-header-card">
                                    <div className="patient-hero-info">
                                        <div className="avatar-lg" style={{ background: avatarColor(initials(selectedPatient)), color: '#fff' }}>
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <div className="hero-name-row">
                                                <h2>{pname(selectedPatient)}</h2>
                                                <span className="hero-id-badge">{selectedPatient.patient_id}</span>
                                            </div>
                                            <div className="hero-meta-row">
                                                <span>{age(selectedPatient.dob) || 'No Age'}</span>
                                                <span>•</span>
                                                <span style={{ textTransform: 'capitalize' }}>{selectedPatient.gender || 'Not specified'}</span>
                                                {(selectedPatient.parent_mobile || selectedPatient.wa_id) && (
                                                    <>
                                                        <span>•</span>
                                                        <span>📞 {selectedPatient.parent_mobile || selectedPatient.wa_id}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-header-v4 btn-primary-v4"
                                        style={{ height: '40px', padding: '0 18px', fontSize: '0.88rem' }}
                                        onClick={openEntryModal}
                                    >
                                        <Plus size={16} />
                                        <span>New Clinical Entry</span>
                                    </button>
                                </div>

                                <div className="overview-body-grid">
                                    <div className="overview-card-notice">
                                        <div className="notice-icon-circle">
                                            <Clipboard size={26} />
                                        </div>
                                        <h3>Ready for Clinical Consultation</h3>
                                        <p>No previous consultation or immunization records have been recorded for {pname(selectedPatient)}. Start documenting the visit, vitals, diagnosis, and prescription plan.</p>
                                        <button
                                            type="button"
                                            className="btn-start-consultation-main"
                                            onClick={openEntryModal}
                                        >
                                            <Plus size={16} /> Start Consultation
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-selection">
                                <div className="empty-selection-icon-wrap">
                                    <Shield size={32} />
                                </div>
                                <h3>Clinical Intelligence</h3>
                                <p>Select a patient from the side panel to view clinical history or document a new consultation.</p>
                            </div>
                        )
                    ) : (
                        <div className="record-detail-v3">
                            <div className="detail-header-v3">
                                <div className="primary-info">
                                    <div className="visit-badge">{selectedRecord.visit_type}</div>
                                    <h2>{selectedRecord.diagnosis || selectedRecord.chief_complaint || 'Clinical Examination'}</h2>
                                    <div className="meta">
                                        <span><Calendar size={14} /> {fmt(selectedRecord.visit_date || selectedRecord.createdAt)}</span>
                                        <span><User size={14} /> {selectedRecord.attending_doctor}</span>
                                    </div>
                                </div>
                                <div className="detail-actions">
                                    <button
                                        className="btn-icon"
                                        onClick={async () => {
                                            if (!selectedRecord?._id) return;
                                            try {
                                                const res = await sendPrescriptionViaWhatsApp(selectedRecord._id);
                                                alert(res.data.message || "Prescription sent via WhatsApp");
                                            } catch (e) {
                                                alert(e.response?.data?.message || "Failed to send via WhatsApp");
                                            }
                                        }}
                                        title="Send via WhatsApp"
                                        style={{ color: '#25d366' }}
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        title="Download PDF Summary"
                                        onClick={() => {
                                            if (!selectedRecord?._id) return;
                                            window.open(getMRDEntryPdfUrl(selectedRecord._id), '_blank');
                                        }}
                                        style={{ color: '#ef4444' }}
                                    >
                                        <Download size={18} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        title="Print Record"
                                        onClick={handlePrint}
                                    >
                                        <Printer size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-save-v3"
                                        style={{ height: '36px', padding: '0 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        onClick={openEntryModal}
                                        title="Document New Visit"
                                    >
                                        <Plus size={15} /> New Entry
                                    </button>
                                </div>
                            </div>

                            <nav className="detail-tabs-v3">
                                {[
                                    { id: 'details', label: 'Clinical Summary' },
                                    { id: 'prescription', label: `Rx Plan (${prescriptionLines.length})` },
                                    { id: 'attachments', label: `Files & Images (${selectedRecord.attachments?.length || 0})` },
                                    { id: 'followup', label: 'Prognosis & Follow-up' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        className={tab === t.id ? 'active' : ''}
                                        onClick={() => setTab(t.id)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </nav>

                            <div className="tab-content-v3">
                                {tab === 'details' && (
                                    <>
                                        <article className="info-block-v3">
                                            <label>Visit Reason & Consents</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                {selectedRecord.visit_tags?.length > 0 && (
                                                    <div className="symptoms-chips">
                                                        {selectedRecord.visit_tags.map((t, i) => (
                                                            <span key={i} className="sym-chip" style={{ background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }}>{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {selectedRecord.consents?.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                        {selectedRecord.consents.filter(c => c.is_accepted).map((c, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                                                                <Shield size={12} />
                                                                <span>{c.consent_type} Accepted</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </article>
                                        {(selectedRecord.weight || selectedRecord.height || selectedRecord.bmi || selectedRecord.temperature || selectedRecord.spo2 || selectedRecord.pulse || selectedRecord.bp || selectedRecord.respiration || selectedRecord.random_sugar || selectedRecord.head_circumference || selectedRecord.pain_score || selectedRecord.fall_risk || selectedRecord.interpreter) && (
                                            <article className="info-block-v3 vitals-display">
                                                <label>Vitals Check</label>
                                                <div className="vitals-grid">
                                                    {selectedRecord.weight && <div className="vital-item"><span>Weight:</span> <strong>{selectedRecord.weight} kg</strong></div>}
                                                    {selectedRecord.height && <div className="vital-item"><span>Height:</span> <strong>{selectedRecord.height} cm</strong></div>}
                                                    {selectedRecord.bmi && <div className="vital-item"><span>BMI:</span> <strong>{selectedRecord.bmi}</strong></div>}
                                                    {selectedRecord.temperature && <div className="vital-item"><span>Temp:</span> <strong>{selectedRecord.temperature} °F</strong></div>}
                                                    {selectedRecord.bp && <div className="vital-item"><span>BP:</span> <strong>{selectedRecord.bp} mmHg</strong></div>}
                                                    {selectedRecord.pulse && <div className="vital-item"><span>Pulse:</span> <strong>{selectedRecord.pulse} bpm</strong></div>}
                                                    {selectedRecord.respiration && <div className="vital-item"><span>Resp. Rate:</span> <strong>{selectedRecord.respiration} /min</strong></div>}
                                                    {selectedRecord.spo2 && <div className="vital-item"><span>SPO2:</span> <strong>{selectedRecord.spo2} %</strong></div>}
                                                    {selectedRecord.random_sugar && <div className="vital-item"><span>Random Sugar:</span> <strong>{selectedRecord.random_sugar} mg/dL</strong></div>}
                                                    {selectedRecord.head_circumference && <div className="vital-item"><span>Head Cir.:</span> <strong>{selectedRecord.head_circumference} cm</strong></div>}
                                                    {selectedRecord.pain_score && <div className="vital-item"><span>Pain Score:</span> <strong>{selectedRecord.pain_score}/10</strong></div>}
                                                    {selectedRecord.fall_risk && <div className="vital-item"><span>Fall Risk:</span> <strong>{selectedRecord.fall_risk}</strong></div>}
                                                    {selectedRecord.interpreter && <div className="vital-item"><span>Interpreter:</span> <strong>{selectedRecord.interpreter}</strong></div>}
                                                </div>
                                            </article>
                                        )}
                                        {selectedRecord.symptoms && (Array.isArray(selectedRecord.symptoms) ? selectedRecord.symptoms.length > 0 : String(selectedRecord.symptoms).length > 0) && (
                                            <article className="info-block-v3">
                                                <label>Reporting Symptoms</label>
                                                <div className="symptoms-chips">
                                                    {(Array.isArray(selectedRecord.symptoms) ? selectedRecord.symptoms : [selectedRecord.symptoms]).map((s, i) => (
                                                        <span key={i} className="sym-chip">{s}</span>
                                                    ))}
                                                </div>
                                            </article>
                                        )}
                                        {selectedRecord.allergies?.length > 0 && (
                                            <article className="info-block-v3">
                                                <label style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <AlertTriangle size={13} /> Allergy Information
                                                </label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    {selectedRecord.allergies.map((al, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', background: '#fef9f9', borderRadius: '8px', border: '1px solid #fee2e2', fontSize: '0.82rem' }}>
                                                            <span style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>{al.category}</span>
                                                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{al.type || '—'}</span>
                                                            {al.reaction && (
                                                                <span style={{ fontWeight: 800, fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: al.reaction === 'High' ? '#fee2e2' : al.reaction === 'Moderate' ? '#fef3c7' : '#d1fae5', color: al.reaction === 'High' ? '#dc2626' : al.reaction === 'Moderate' ? '#b45309' : '#065f46' }}>
                                                                    {al.reaction === 'High' ? '🔴' : al.reaction === 'Moderate' ? '🟡' : '🟢'} {al.reaction}
                                                                </span>
                                                            )}
                                                            {al.duration && <span style={{ color: '#64748b', fontWeight: 600 }}>• {al.duration}</span>}
                                                            {al.informed_by && <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>by {al.informed_by}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </article>
                                        )}
                                        <article className="info-block-v3">
                                            <label>Chief Complaint</label>
                                            {selectedRecord.chief_complaints_list?.length > 0 ? (
                                                <div className="symptoms-chips" style={{ marginBottom: '0.5rem' }}>
                                                    {selectedRecord.chief_complaints_list.map((c, i) => (
                                                        <span key={i} className="sym-chip" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>{c}</span>
                                                    ))}
                                                </div>
                                            ) : null}
                                            {selectedRecord.chief_complaint && <p>{selectedRecord.chief_complaint}</p>}
                                            {(!selectedRecord.chief_complaint && (!selectedRecord.chief_complaints_list || selectedRecord.chief_complaints_list.length === 0)) && (
                                                <p>No complaint recorded.</p>
                                            )}
                                        </article>
                                        {selectedRecord.history_of_present_illness && (
                                            <article className="info-block-v3">
                                                <label>History of Present Illness</label>
                                                <p>{selectedRecord.history_of_present_illness}</p>
                                            </article>
                                        )}
                                        {selectedRecord.past_history && (
                                            <article className="info-block-v3">
                                                <label>Past History</label>
                                                <p>{selectedRecord.past_history}</p>
                                            </article>
                                        )}
                                        {selectedRecord.personal_history && (
                                            <article className="info-block-v3">
                                                <label>Personal & Socioeconomic History</label>
                                                <p>{selectedRecord.personal_history}</p>
                                            </article>
                                        )}
                                        {(selectedRecord.family_history || selectedRecord.family_diseases?.length > 0) && (
                                            <article className="info-block-v3">
                                                <label>Family History</label>
                                                {selectedRecord.family_history && <p>{selectedRecord.family_history}</p>}
                                                {selectedRecord.family_diseases?.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {selectedRecord.family_diseases.map((fd, i) => (
                                                            <span key={i} style={{ background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                                                                {fd.disease} ({fd.relationship})
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </article>
                                        )}


                                        {/* Physical Exam Read View */}
                                        {(selectedRecord.physical_examination || selectedRecord.systemic_examination || selectedRecord.pe_pallor) && (
                                            <article className="info-block-v3">
                                                <label>Physical Examination</label>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                                    {['pallor', 'icterus', 'oedema', 'lymphadenopathy', 'cyanosis', 'clubbing'].map(pe => {
                                                        const val = selectedRecord[`pe_${pe}`];
                                                        if (!val) return null;
                                                        return (
                                                            <div key={pe} style={{ fontSize: '0.85rem' }}>
                                                                <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{pe}: </span>
                                                                <span style={{ fontWeight: 700, color: val === 'Yes' ? '#dc2626' : '#10b981' }}>{val}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {selectedRecord.physical_examination && (
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <strong style={{ display: 'block', fontSize: '0.85rem', color: '#475569', marginBottom: '0.2rem' }}>General Physical Examination</strong>
                                                        <p>{selectedRecord.physical_examination}</p>
                                                    </div>
                                                )}
                                                {selectedRecord.systemic_examination && (
                                                    <div>
                                                        <strong style={{ display: 'block', fontSize: '0.85rem', color: '#475569', marginBottom: '0.2rem' }}>Systemic Examination</strong>
                                                        <p>{selectedRecord.systemic_examination}</p>
                                                    </div>
                                                )}
                                            </article>
                                        )}
                                        {selectedRecord.diagram_image && (
                                            <article className="info-block-v3">
                                                <label>Annotated Diagram</label>
                                                <p>{selectedRecord.diagram_image}</p>
                                            </article>
                                        )}
                                        <article className="info-block-v3">
                                            <label>Clinical Notes / Old Reports</label>
                                            <p>{selectedRecord.clinical_notes || 'No notes recorded.'}</p>
                                        </article>
                                        {selectedRecord.provisional_diagnoses?.length > 0 && (
                                            <article className="info-block-v3">
                                                <label>Provisional Diagnoses</label>
                                                <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>S.No.</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Diagnosis</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>ICD 10</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Stage</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Type</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedRecord.provisional_diagnoses.map((diag, idx) => (
                                                                <tr key={idx}>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{idx + 1}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', fontWeight: 600 }}>{diag.diagnosis_name}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{diag.icd_10 || '-'}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{diag.stage}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{diag.type}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </article>
                                        )}
                                        {selectedRecord.medication_history?.length > 0 && (
                                            <article className="info-block-v3">
                                                <label>Medication History</label>
                                                <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>S.No</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Drug</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Form</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Dose</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Route</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Freq.</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Continued</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedRecord.medication_history.map((med, idx) => (
                                                                <tr key={idx}>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{idx + 1}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', fontWeight: 600 }}>{med.drug}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.form}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.dose}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.route}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.frequency}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.to_be_continued}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </article>
                                        )}
                                        {(selectedRecord.investigations_list?.length > 0 || selectedRecord.investigations) && (
                                            <article className="info-block-v3">
                                                <label>Investigations</label>
                                                {selectedRecord.investigations_list?.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {selectedRecord.investigations_list.map((inv, i) => (
                                                            <span key={i} style={{ background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                                                                {inv.name} ({inv.priority})
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {selectedRecord.investigations && <p style={{ marginTop: '0.5rem' }}>{selectedRecord.investigations}</p>}
                                            </article>
                                        )}
                                        {(selectedRecord.procedures_list?.length > 0 || selectedRecord.other_procedure) && (
                                            <article className="info-block-v3">
                                                <label>Procedures</label>
                                                {selectedRecord.procedures_list?.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {selectedRecord.procedures_list.map((proc, i) => (
                                                            <span key={i} style={{ background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                                                                {proc.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {selectedRecord.other_procedure && <p style={{ marginTop: '0.5rem' }}>{selectedRecord.other_procedure}</p>}
                                            </article>
                                        )}
                                        {(selectedRecord.prescriptions_list?.length > 0 || selectedRecord.prescription) && (
                                            <article className="info-block-v3">
                                                <label>Medication Advice (Prescription)</label>
                                                {selectedRecord.prescription && <p style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', whiteSpace: 'pre-line' }}>{selectedRecord.prescription}</p>}
                                                {selectedRecord.prescriptions_list?.length > 0 && (
                                                    <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>S.No</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Medicine & Form</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Indication</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Schedule & Route</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Duration</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Qty / Refills</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Instructions & Precautions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {selectedRecord.prescriptions_list.map((med, idx) => (
                                                                    <tr key={idx}>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                                                                            {med.medicine}
                                                                            {med.dosage_form && <span style={{ marginLeft: '6px', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px' }}>{med.dosage_form}</span>}
                                                                            {med.type === 'Generic' && <span style={{ marginLeft: '4px', fontSize: '0.7rem', color: '#64748b' }}>(Generic)</span>}
                                                                        </td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', color: '#0284c7' }}>{med.indication || '-'}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                                                                            <strong>{med.schedule}</strong>
                                                                            {med.route && <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{med.route}</span>}
                                                                        </td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.days ? `${med.days} days` : '-'}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                                                                            {med.quantity || '-'}
                                                                            {med.refills && med.refills !== '0' && <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Refills: {med.refills}</span>}
                                                                        </td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                                                                            {med.instruction && <div>{med.instruction}</div>}
                                                                            {med.special_instructions && <div style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>⚠ {med.special_instructions}</div>}
                                                                            {med.pharmacist_notes && <div style={{ fontSize: '0.75rem', color: '#0d9488' }}>ℹ {med.pharmacist_notes}</div>}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </article>
                                        )}
                                        {selectedRecord.other_medication && (
                                            <article className="info-block-v3">
                                                <label>Other Medication (OTC & Supplements)</label>
                                                <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-line' }}>{selectedRecord.other_medication}</p>
                                            </article>
                                        )}
                                        {(selectedRecord.dietary_plan || selectedRecord.activity_restrictions || selectedRecord.home_monitoring || selectedRecord.school_work_note || selectedRecord.storage_instructions || selectedRecord.side_effects_warning || selectedRecord.pregnancy_lactation_status) && (
                                            <article className="info-block-v3">
                                                <label>Non-Medication Prescriptions & Patient Safety</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                    {selectedRecord.dietary_plan && (
                                                        <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: '2px' }}>🥗 Dietary & Nutrition Plan</strong>
                                                            {selectedRecord.dietary_plan}
                                                        </div>
                                                    )}
                                                    {selectedRecord.activity_restrictions && (
                                                        <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: '2px' }}>🏃 Activity Restrictions</strong>
                                                            {selectedRecord.activity_restrictions}
                                                        </div>
                                                    )}
                                                    {selectedRecord.home_monitoring && (
                                                        <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: '2px' }}>🩺 Home Monitoring Plan</strong>
                                                            {selectedRecord.home_monitoring}
                                                        </div>
                                                    )}
                                                    {selectedRecord.school_work_note && (
                                                        <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: '2px' }}>📝 School / Work Excuse</strong>
                                                            {selectedRecord.school_work_note}
                                                        </div>
                                                    )}
                                                    {selectedRecord.storage_instructions && (
                                                        <div style={{ background: '#fffbeb', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.85rem', color: '#92400e' }}>
                                                            <strong style={{ display: 'block', marginBottom: '2px' }}>❄ Medication Storage</strong>
                                                            {selectedRecord.storage_instructions}
                                                        </div>
                                                    )}
                                                    {selectedRecord.side_effects_warning && (
                                                        <div style={{ background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '0.85rem', color: '#991b1b' }}>
                                                            <strong style={{ display: 'block', marginBottom: '2px' }}>⚠ Side Effects & Precautions</strong>
                                                            {selectedRecord.side_effects_warning}
                                                        </div>
                                                    )}
                                                    {selectedRecord.pregnancy_lactation_status && (
                                                        <div style={{ background: '#fdf2f8', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #fbcfe8', fontSize: '0.85rem', color: '#9d174d' }}>
                                                            <strong style={{ display: 'block', marginBottom: '2px' }}>🤱 Pregnancy / Lactation Status</strong>
                                                            {selectedRecord.pregnancy_lactation_status}
                                                        </div>
                                                    )}
                                                </div>
                                            </article>
                                        )}
                                        {(selectedRecord.advice || selectedRecord.admission_status) && (
                                            <article className="info-block-v3">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label>General Advice & Instructions</label>
                                                    {selectedRecord.admission_status === 'Required' && (
                                                        <span style={{ background: '#fee2e2', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                            Admission Required
                                                        </span>
                                                    )}
                                                </div>
                                                {selectedRecord.advice && <p className="advice-text" style={{ marginTop: '0.5rem', whiteSpace: 'pre-line' }}>{selectedRecord.advice}</p>}
                                            </article>
                                        )}
                                        {selectedRecord.next_visit_due && (
                                            <article className="info-block-v3">
                                                <label>Follow-up</label>
                                                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>Date: {selectedRecord.next_visit_due}</p>
                                                {selectedRecord.followup_advice && <p style={{ marginTop: '0.2rem' }}>{selectedRecord.followup_advice}</p>}
                                            </article>
                                        )}
                                        {selectedRecord.referrals_list?.length > 0 && (
                                            <article className="info-block-v3">
                                                <label>Referrals</label>
                                                <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Location</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Speciality</th>
                                                                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Doctor</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedRecord.referrals_list.map((ref, idx) => (
                                                                <tr key={idx}>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{ref.location}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{ref.speciality}</td>
                                                                    <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{ref.doctor}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </article>
                                        )}
                                        {(selectedRecord.intent_of_treatment || selectedRecord.additional_remarks || selectedRecord.refer_to_tumor_board === 'Yes' || selectedRecord.nutrition_advice === 'Yes' || selectedRecord.psychology_advice === 'Yes' || selectedRecord.physiotherapy_advice === 'Yes' || selectedRecord.complex_care === 'Yes') && (
                                            <article className="info-block-v3">
                                                <label>Additional Information</label>
                                                {selectedRecord.intent_of_treatment && <p style={{ marginTop: '0.5rem' }}><strong>Intent of Treatment:</strong> {selectedRecord.intent_of_treatment}</p>}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                                                    {selectedRecord.refer_to_tumor_board === 'Yes' && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Tumor Board Referral</span>}
                                                    {selectedRecord.nutrition_advice === 'Yes' && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Nutrition Advice</span>}
                                                    {selectedRecord.psychology_advice === 'Yes' && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Psychology Advice</span>}
                                                    {selectedRecord.physiotherapy_advice === 'Yes' && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Physiotherapy Advice</span>}
                                                    {selectedRecord.complex_care === 'Yes' && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Complex Care</span>}
                                                </div>
                                                {selectedRecord.additional_remarks && <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Remarks:</strong> {selectedRecord.additional_remarks}</p>}
                                            </article>
                                        )}
                                        {selectedRecord.visit_type === 'VACCINATION' && (
                                            <article className="info-block-v3 vaccination">
                                                <label>Immunization Track</label>
                                                <div className="vaccine-box">
                                                    <Shield size={16} />
                                                    <span>{selectedRecord.diagnosis || selectedRecord.vaccine_given || "Regular Immunization"}</span>
                                                </div>
                                                {selectedRecord.vaccine_batch && (
                                                    <div className="vaccine-batch" style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                                                        <strong>Batch/Brand:</strong> {selectedRecord.vaccine_batch}
                                                    </div>
                                                )}
                                            </article>
                                        )}
                                    </>
                                )}

                                {tab === 'attachments' && (
                                    <div className="attachments-view-v3">
                                        {selectedRecord.attachments?.length > 0 ? (
                                            <div className="image-grid-v3">
                                                {selectedRecord.attachments.map((att, idx) => {
                                                    const isPdf = att.file_type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
                                                    return (
                                                        <div key={idx} className="img-card-v3">
                                                            {isPdf ? (
                                                                <div className="pdf-placeholder-v3">
                                                                    <FileText size={48} />
                                                                    <span>{att.name}</span>
                                                                </div>
                                                            ) : (
                                                                <img src={att.url} alt={att.name} />
                                                            )}
                                                            <div className="img-overlay">
                                                                <span className="img-name">{att.name}</span>
                                                                <div className="img-actions">
                                                                    <button className="img-btn" onClick={() => window.open(att.url, '_blank')}><Eye size={16} /></button>
                                                                    <a href={att.url} download={att.name} className="img-btn"><Download size={14} /></a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="empty-state-mini">
                                                <Paperclip size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                                <p>No medical screenshots or scans have been uploaded for this visit.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {tab === 'prescription' && (
                                    <div className="prescription-view-v3">
                                        {prescriptionLines.length > 0 ? (
                                            prescriptionLines.map((line, idx) => (
                                                <div key={idx} className="rx-line-v3">
                                                    <div className="rx-num">{idx + 1}</div>
                                                    <div className="rx-text">{line}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state">No pharmacological plan recorded.</div>
                                        )}
                                    </div>
                                )}

                                {tab === 'followup' && (
                                    <div className="followup-view-v3">
                                        <div className="info-block-v3">
                                            <label>Next Recommended Visit</label>
                                            <div className="next-due-card">
                                                <Calendar size={24} />
                                                <div className="val">
                                                    {selectedRecord.next_visit_due ? fmt(selectedRecord.next_visit_due) : 'PRN (As required)'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>


        </div>
    );
};

export default ClinicalEntry;
