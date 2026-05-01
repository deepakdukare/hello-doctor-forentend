import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Printer, Lock, Paperclip, Plus, X, FileText, RefreshCw, Activity, User, Calendar, Shield, ArrowRight, Clock, Eye, MessageCircle, Clipboard, Zap, Stethoscope, AlertTriangle, Trash2 } from 'lucide-react';
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
    getMasterData
} from '../api/index';

const EMPTY_ALLERGY = { category: 'Drug', type: '', reaction: '', intensity: '', duration: '', informed_by: '' };

const EMPTY_ENTRY = {
    patient_id: '', appointment_id: '', visit_date: toIsoDate(),
    visit_type: 'CONSULTATION', attending_doctor: 'Dr. Indu',
    chief_complaint: '', clinical_notes: '', diagnosis: '',
    prescription: '', investigations: '', next_visit_due: '', recorded_by: 'Dr. Indu',
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
    consents: [
        { consent_type: 'Treatment Consent', is_accepted: false, witness_name: '' },
        { consent_type: 'Vaccination Consent', is_accepted: false, witness_name: '' },
        { consent_type: 'Data Usage Consent', is_accepted: false, witness_name: '' }
    ]
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
const age = (dob) => {
    if (!dob) return '';
    const d = new Date(dob);
    if (isNaN(d)) return '';
    const totalM = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
    const y = Math.floor(totalM / 12), m = totalM % 12;
    return [y > 0 && `${y}y`, m > 0 && `${m}m`].filter(Boolean).join(' ');
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
    const [familyDiseaseDraft, setFamilyDiseaseDraft] = useState({ disease: '', relationship: '' });
    const [diagnosisDraft, setDiagnosisDraft] = useState({ diagnosis_name: '', icd_10: '', stage: 'Provisional', type: 'Primary', notes: '' });
    const [investigationDraft, setInvestigationDraft] = useState({ name: '', priority: 'Routine' });
    const [procedureDraft, setProcedureDraft] = useState({ name: '' });
    const [medicationHistoryDraft, setMedicationHistoryDraft] = useState({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
    const [prescriptionDraft, setPrescriptionDraft] = useState({ type: 'Brand', medicine: '', schedule: '', instruction: '', days: '', route: '' });
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
                if (combined.length) setSelectedRecord(combined[0]);

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
                attending_doctor: prefFromAppt.attending_doctor || prefFromAppt.doctor_name || 'Dr. Indu',
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
            setDiagnosisDraft({ diagnosis_name: '', icd_10: '', stage: 'Provisional', type: 'Primary', notes: '' });
            setInvestigationDraft({ name: '', priority: 'Routine' });
            setProcedureDraft({ name: '' });
            setMedicationHistoryDraft({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
            setPrescriptionDraft({ type: 'Brand', medicine: '', schedule: '', instruction: '', days: '', route: '' });
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
        const medicines = (record.prescription || "")
            .split("\n")
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
            <title>Prescription</title>
            <base href="${window.location.origin}/">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    color: #000;
                }
                .header {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    border-bottom: 2px solid #000;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                }
                .header-top {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 15px;
                }
                .header-text {
                    text-align: left;
                }
                .header-logo {
                    height: 80px;
                    width: auto;
                }
                .patient-header-info {
                    text-align: left;
                    font-size: 0.85rem;
                    line-height: 1.5;
                }
                .section {
                    margin-bottom: 15px;
                }
                .title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                table, th, td {
                    border: 1px solid #000;
                }
                th, td {
                    padding: 8px;
                    text-align: left;
                }
                .footer {
                    margin-top: 40px;
                    text-align: right;
                }
            </style>
        </head>

        <body>

            <div class="header">
                <div class="header-top">
                    <img src="logo.jpg" class="header-logo" alt="Clinic Logo" />
                    <div class="header-text">
                        <h2 style="margin: 0;">Dr. Indu's New Born & Childcare Center</h2>
                    </div>
                </div>
                <div class="patient-header-info">
                    <strong>Patient Name:</strong> ${[patient?.first_name || patient?.name, patient?.last_name].filter(Boolean).join(' ') || '-'}<br/>
                    <strong>Patient ID:</strong> ${patient?.patient_id || '-'}<br/>
                    <strong>Date:</strong> ${new Date(record.visit_date).toLocaleDateString('en-IN')}<br/>
                    <strong>Doctor:</strong> ${record.attending_doctor}<br/>
                    <strong>Visit Type:</strong> ${record.visit_type}
                </div>
            </div>

            <div class="section">
                <div class="title">Chief Complaint</div>
                <div>${record.chief_complaint || '-'}</div>
            </div>

            <div class="section">
                <div class="title">Vitals</div>
                <div>
                    Temp: ${record.temperature || '-'} °F |
                    Pulse: ${record.pulse || '-'} bpm |
                    SPO2: ${record.spo2 || '-'}% <br/>
                    Weight: ${record.weight || '-'} kg |
                    Height: ${record.height || '-'} cm
                </div>
            </div>

            <div class="section">
                <div class="title">Clinical Notes</div>
                <div>${record.clinical_notes || '-'}</div>
            </div>

            <div class="section">
                <div class="title">Diagnosis</div>
                <div>${record.diagnosis || '-'}</div>
            </div>

            <div class="section">
                <div class="title">Prescription</div>
                <table>
                    <tr>
                        <th>Medicine</th>
                        <th>Dose</th>
                        <th>Duration</th>
                    </tr>
                    ${medicines.map(m => `
                        <tr>
                            <td>${m.name}</td>
                            <td>${m.dose}</td>
                            <td>${m.duration}</td>
                        </tr>
                    `).join("")}
                </table>
            </div>

            <div class="section">
                <div class="title">Symptoms</div>
                <div>${(record.symptoms || []).join(", ")}</div>
            </div>

            <div class="section">
                <div class="title">Advice</div>
                <div>${record.advice || '-'}</div>
            </div>

            <div class="section">
                <div class="title">Next Visit</div>
                <div>${record.next_visit_due ? new Date(record.next_visit_due).toLocaleDateString() : '-'}</div>
            </div>

            <div class="footer">
                <p>Doctor Signature</p>
                <p>${record.attending_doctor}</p>
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
                diagnosis: form.diagnosis || finalDiagnoses.map(d => d.diagnosis_name || d.diagnosis).filter(Boolean).join(', '),
                prescription: form.prescription || finalPrescriptions.map(p => `${p.medicine} - ${p.dosage} - ${p.days} days`).filter(Boolean).join('\n'),
                provisional_diagnoses: finalDiagnoses.map((diag) => ({
                    diagnosis: diag.diagnosis_name || diag.diagnosis || '',
                    code: diag.icd_10 || diag.code || '',
                    stage: diag.stage || '',
                    type: diag.type || '',
                    notes: diag.notes || ''
                })),
                investigations_list: finalInvestigations.map((item) => ({
                    test_name: item.name || item.test_name || '',
                    priority: item.priority || 'Routine',
                    notes: item.notes || ''
                })),
                investigations: form.investigations || finalInvestigations.map(i => i.name || i.test_name).filter(Boolean).join(', '),
                procedures_list: finalProcedures.map((item) => ({
                    name: item.name || ''
                })),
                advice: form.advice || [
                    form.advice_home_care ? `HOME CARE:\n${form.advice_home_care}` : '',
                    form.advice_diet ? `DIET:\n${form.advice_diet}` : '',
                    form.advice_warning_signs ? `WARNING SIGNS:\n${form.advice_warning_signs}` : ''
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
                    generic_name: item.type === 'Generic' ? item.medicine : '',
                    dosage: item.dosage || '',
                    schedule: item.schedule || '',
                    route: item.route || '',
                    instruction: item.instruction || '',
                    days: item.days ? Number(item.days) : null
                }))
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
                setFormStatus({ error: "Conflict: This Patient ID already has an existing Medical Documentation record. Multiple records for the same ID are not allowed.", success: null });
            } else {
                setFormStatus({ error: errorMsg, success: null });
            }
        }
        finally { setSaving(false); }
    };

    const openEntryModal = async () => {
        setShowModal(true);
        setFormStatus({ error: null, success: null });
        setForm({ ...EMPTY_ENTRY, patient_id: selectedPatient?.patient_id || '', attachments: [] });
        setAllergyDraft({ ...EMPTY_ALLERGY });
        setFamilyDiseaseDraft({ disease: '', relationship: '' });
        setDiagnosisDraft({ diagnosis_name: '', icd_10: '', stage: 'Provisional', type: 'Primary', notes: '' });
        setInvestigationDraft({ name: '', priority: 'Routine' });
        setProcedureDraft({ name: '' });
        setMedicationHistoryDraft({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
        setPrescriptionDraft({ type: 'Brand', medicine: '', schedule: '', instruction: '', days: '', route: '' });
        setGlobalDays('');
        setReferralDraft({ location: '', speciality: '', doctor: '' });
        // Fetch full patient details for the info display
        if (selectedPatient?.patient_id) {
            setPatientDetailsLoading(true);
            try {
                const r = await getComprehensiveProfile(selectedPatient.patient_id);
                const { patient, mrd_entries } = r.data?.data || {};
                setPatientDetails(patient);
                
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
        <div className="appointments-page-v4" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Medical Documentation</h1>
                    <p>Longitudinal health records and clinical history</p>
                </div>
                <div className="header-right-v4">
                    <button className="btn-header-v4" onClick={() => loadDirectory()}>
                        <RefreshCw size={16} className={dirLoading ? 'spinning' : ''} />
                        <span>Sync Directory</span>
                    </button>
                    <button className="btn-header-v4 btn-primary-v4" onClick={openEntryModal}>
                        <Plus size={16} />
                        <span>New Entry</span>
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
                                    {isSelected && <ArrowRight size={14} className="selected-indicator" />}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* 2. Timeline Panel */}
                <aside className="mrd-panel-v3 timeline-panel">
                    {!selectedPatient ? (
                        <div className="empty-selection">
                            <FileText size={48} />
                            <h3>Choose a Patient</h3>
                            <p>Select a profile from the directory to view their health journey.</p>
                        </div>
                    ) : (
                        <>
                            <div className="panel-header-v3">
                                <div className="selected-patient-meta">
                                    <h3>{pname(selectedPatient)}</h3>
                                    <p>{selectedPatient.patient_id}</p>
                                </div>
                                <button className="btn-add-mini" onClick={openEntryModal}>
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="timeline-filters">
                                <div className="keyword-search">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Filter records..."
                                        value={keywordSearch}
                                        onChange={(e) => setKeywordSearch(e.target.value)}
                                    />
                                </div>
                                <div className="type-pills">
                                    {['ALL', 'CONSULTATION', 'VACCINATION'].map(type => (
                                        <button
                                            key={type}
                                            className={filterType === type ? 'active' : ''}
                                            onClick={() => setFilterType(type)}
                                        >
                                            {type === 'ALL' ? 'Total' : type === 'CONSULTATION' ? 'Clinic' : 'Immune'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="records-timeline-v3">
                                {recLoading ? (
                                    <div className="loading-state">
                                        <RefreshCw size={24} className="spinning" />
                                    </div>
                                ) : filteredRecords.length === 0 ? (
                                    <div className="no-records">
                                        <FileText size={40} style={{ opacity: 0.2 }} />
                                        <p>No records identified.</p>
                                    </div>
                                ) : filteredRecords.map((rec, i) => (
                                    <div
                                        key={rec._id || rec.appointment_id || i}
                                        className={`record-card-v3 ${selectedRecord === rec ? 'selected' : ''} ${rec.is_pending_record ? 'pending-state' : ''}`}
                                        onClick={() => { setSelectedRecord(rec); setTab('details'); }}
                                    >
                                        <div className="record-header">
                                            <span className="record-date">{fmt(rec.visit_date || rec.createdAt)}</span>
                                            <span className={`type-tag ${rec.visit_type?.toLowerCase()}`}>{rec.visit_type}</span>
                                        </div>
                                        <div className="record-diagnosis">
                                            {rec.is_pending_record && <Clock size={14} className="pending-icon" />}
                                            {rec.diagnosis || rec.vaccine_given || rec.chief_complaint || 'General Checkup'}
                                        </div>
                                        <div className="record-footer">
                                            <div className="doctor-pill"><Activity size={10} /> {rec.attending_doctor}</div>
                                            {rec.prescription && <div className="attachment-pill"><Paperclip size={10} /> Rx</div>}
                                            {rec.attachments?.length > 0 && <div className="attachment-pill" style={{ background: '#ecfdf5', color: '#059669' }}><Paperclip size={10} /> {rec.attachments.length} Img</div>}
                                            {rec.is_pending_record && (
                                                <button className="btn-record-now" onClick={(e) => { e.stopPropagation(); selectPatientRecord(selectedPatient, rec); }}>
                                                    Complete Now <Plus size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </aside>

                {/* 3. Detailed View Panel */}
                <main className="mrd-main-v3">
                    {!selectedRecord ? (
                        <div className="empty-selection">
                            <Shield size={64} style={{ opacity: 0.1 }} />
                            <h3>Clinical Intelligence</h3>
                            <p>Detailed longitudinal analysis will appear here.</p>
                        </div>
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
                                                <label>Medication Advice</label>
                                                {selectedRecord.prescription && <p style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>{selectedRecord.prescription}</p>}
                                                {selectedRecord.prescriptions_list?.length > 0 && (
                                                    <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>S.No</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Medicine</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Schedule</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Instruction</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Days</th>
                                                                    <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Route</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {selectedRecord.prescriptions_list.map((med, idx) => (
                                                                    <tr key={idx}>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', fontWeight: 600 }}>{med.medicine}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.schedule}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.instruction}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.days}</td>
                                                                        <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>{med.route}</td>
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
                                                <label>Other Medication</label>
                                                <p style={{ marginTop: '0.5rem' }}>{selectedRecord.other_medication}</p>
                                            </article>
                                        )}
                                        {(selectedRecord.advice || selectedRecord.admission_status) && (
                                            <article className="info-block-v3">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label>Advice & Instructions</label>
                                                    {selectedRecord.admission_status === 'Required' && (
                                                        <span style={{ background: '#fee2e2', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                            Admission Required
                                                        </span>
                                                    )}
                                                </div>
                                                {selectedRecord.advice && <p className="advice-text" style={{ marginTop: '0.5rem' }}>{selectedRecord.advice}</p>}
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

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay-v3">
                    <div className="modal-content-v3">
                        <header className="modal-header-v3" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff', padding: '1.25rem 2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#eef2ff', color: '#6366f1', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Clipboard size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1e293b' }}>New Clinical Entry</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Document patient visit and clinical observations</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="btn-header-v4"
                                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                    onClick={() => setForm({
                                        ...EMPTY_ENTRY,
                                        patient_id: '26-HA6',
                                        visit_date: '2026-04-08',
                                        visit_type: 'CONSULTATION',
                                        attending_doctor: 'Dr. Indu',
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
                                <button onClick={() => setShowModal(false)} className="close-btn"><X size={20} /></button>
                            </div>
                        </header>

                        <form onSubmit={handleAddEntry} className="entry-form-v3 custom-scrollbar">
                            <div className="form-grid-premium">
                                {/* Left Column: Meta & Observation */}
                                <div className="col-span-12">
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Patient Summary</div>
                                        </div>

                                        {/* Patient Info Row — refined style */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem', padding: '1.25rem', background: '#fcfdfe', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
                                                {patientDetailsLoading ? (
                                                    <div style={{ height: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                                                        <RefreshCw size={12} className="spinning" />
                                                    </div>
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
                                                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem', marginTop: '2px' }}>
                                                        {age(patientDetails?.dob || selectedPatient?.dob) || '—'}
                                                        <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: '6px', fontSize: '0.8rem' }}>({fmt(patientDetails?.dob || selectedPatient?.dob)})</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gender</label>
                                                {patientDetailsLoading ? (
                                                    <div style={{ height: '24px', color: '#cbd5e1' }}><RefreshCw size={12} className="spinning" /></div>
                                                ) : (
                                                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem', marginTop: '2px', textTransform: 'capitalize' }}>
                                                        {(patientDetails?.gender || selectedPatient?.gender) || '—'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact</label>
                                                {patientDetailsLoading ? (
                                                    <div style={{ height: '24px', color: '#cbd5e1' }}><RefreshCw size={12} className="spinning" /></div>
                                                ) : (
                                                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem', marginTop: '2px' }}>
                                                        {(patientDetails?.wa_id || patientDetails?.parent_mobile || selectedPatient?.wa_id || selectedPatient?.parent_mobile) || '—'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {(clinicalContext.allergy_summary.length > 0 || clinicalContext.current_meds.length > 0 || clinicalContext.vitals_history.length > 0) && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                                                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '0.75rem' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 800, textTransform: 'uppercase' }}>Allergy Summary</div>
                                                    <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#7c2d12' }}>
                                                        {clinicalContext.allergy_summary.length > 0 ? clinicalContext.allergy_summary.slice(0, 3).join(', ') : 'No prior allergy recorded'}
                                                    </div>
                                                </div>
                                                <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '10px', padding: '0.75rem' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#0e7490', fontWeight: 800, textTransform: 'uppercase' }}>Current Medications</div>
                                                    <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#155e75' }}>
                                                        {clinicalContext.current_meds.length > 0 ? clinicalContext.current_meds.slice(0, 2).map((m) => m.medicine).filter(Boolean).join(', ') : 'No continued medication'}
                                                    </div>
                                                </div>
                                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>Vitals Trend</div>
                                                    <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#14532d' }}>
                                                        {clinicalContext.vitals_history.length > 0 ? `${clinicalContext.vitals_history.length} prior entries` : 'No historical vitals'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {clinicalContext.patient_history.length > 0 && (
                                            <div style={{ marginBottom: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', padding: '0.75rem' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                                    Patient History (Recent Visits)
                                                </div>
                                                <div style={{ display: 'grid', gap: '0.45rem' }}>
                                                    {clinicalContext.patient_history.slice(0, 5).map((item, idx) => (
                                                        <div key={`${item.source}-${item.appointment_id || idx}`} style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                                                            <span style={{ color: '#64748b' }}>{fmt(item.visit_date)}</span>
                                                            <span style={{ fontWeight: 700 }}>{item.visit_type || '-'}</span>
                                                            <span>{item.diagnosis || item.chief_complaint || 'No summary'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
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
                                        </div>
                                        <div className="f-group-premium" style={{ marginTop: '0.5rem' }}>
                                            <label>Attending Doctor</label>
                                            <select className="input-premium-v4" value={form.attending_doctor} onChange={e => setForm({ ...form, attending_doctor: e.target.value })} required>
                                                <option value="">Select Doctor</option>
                                                {doctorsList.map(doc => <option key={doc._id} value={doc.name}>{doc.name}</option>)}
                                                {form.attending_doctor && !doctorsList.find(d => d.name === form.attending_doctor) && (
                                                    <option value={form.attending_doctor}>{form.attending_doctor}</option>
                                                )}
                                            </select>
                                        </div>
                                        {/* ── Patient Vitals ── */}
                                        <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                            <div className="premium-header-v2">
                                                <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Activity size={16} /> Patient Vitals
                                                </div>
                                            </div>

                                            {/* Physical Growth Group */}
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ height: '1px', flex: 1, background: '#f1f5f9' }}></div>
                                                    Growth
                                                    <div style={{ height: '1px', flex: 1, background: '#f1f5f9' }}></div>
                                                </div>
                                                <div className="vitals-grid-v4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                                    <div className="vital-input-v4">
                                                        <label>Weight <span style={{ color: '#94a3b8', fontWeight: 500 }}>(kg)</span></label>
                                                        <input placeholder="0.0" value={form.weight} onChange={e => { const w = e.target.value; setForm({ ...form, weight: w, bmi: calcBMI(w, form.height) }); }} />
                                                    </div>
                                                    <div className="vital-input-v4">
                                                        <label>Height <span style={{ color: '#94a3b8', fontWeight: 500 }}>(cm)</span></label>
                                                        <input placeholder="0" value={form.height} onChange={e => { const h = e.target.value; setForm({ ...form, height: h, bmi: calcBMI(form.weight, h) }); }} />
                                                    </div>
                                                    <div className="vital-input-v4" style={{ gridColumn: '1 / -1', background: '#f8faff', borderStyle: 'dashed' }}>
                                                        <label>BMI <span style={{ color: '#6366f1', fontSize: '0.6rem', fontWeight: 700, marginLeft: '6px' }}>Auto</span></label>
                                                        <input placeholder="—" value={form.bmi} readOnly style={{ color: '#6366f1', fontWeight: 800 }} />
                                                    </div>
                                                    <div className="vital-input-v4" style={{ gridColumn: '1 / -1' }}>
                                                        <label>Head Cir. <span style={{ color: '#94a3b8', fontWeight: 500 }}>(cm)</span></label>
                                                        <input placeholder="0" value={form.head_circumference} onChange={e => setForm({ ...form, head_circumference: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Clinical Vitals Group */}
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ height: '1px', flex: 1, background: '#f1f5f9' }}></div>
                                                    Clinical
                                                    <div style={{ height: '1px', flex: 1, background: '#f1f5f9' }}></div>
                                                </div>
                                                <div className="vitals-grid-v4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                                    <div className="vital-input-v4" style={{ borderLeft: '3px solid #ef4444' }}>
                                                        <label>Pulse <span style={{ color: '#94a3b8', fontWeight: 500 }}>(bpm)</span></label>
                                                        <input placeholder="0" value={form.pulse} onChange={e => setForm({ ...form, pulse: e.target.value })} />
                                                    </div>
                                                    <div className="vital-input-v4" style={{ borderLeft: '3px solid #3b82f6' }}>
                                                        <label>SPO2 <span style={{ color: '#94a3b8', fontWeight: 500 }}>(%)</span></label>
                                                        <input placeholder="98" value={form.spo2} onChange={e => setForm({ ...form, spo2: e.target.value })} />
                                                    </div>
                                                    <div className="vital-input-v4">
                                                        <label>Temp <span style={{ color: '#94a3b8', fontWeight: 500 }}>(°F)</span></label>
                                                        <input placeholder="98.6" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} />
                                                    </div>
                                                    <div className="vital-input-v4">
                                                        <label>BP <span style={{ color: '#94a3b8', fontWeight: 500 }}>mm/Hg</span></label>
                                                        <input placeholder="120/80" value={form.bp} onChange={e => setForm({ ...form, bp: e.target.value })} />
                                                    </div>
                                                    <div className="vital-input-v4" style={{ gridColumn: '1 / -1' }}>
                                                        <label>Respiration <span style={{ color: '#94a3b8', fontWeight: 500 }}>b/min</span></label>
                                                        <input placeholder="18" value={form.respiration} onChange={e => setForm({ ...form, respiration: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Assessment Group */}
                                            <div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ height: '1px', flex: 1, background: '#f1f5f9' }}></div>
                                                    Assessment
                                                    <div style={{ height: '1px', flex: 1, background: '#f1f5f9' }}></div>
                                                </div>
                                                <div className="vitals-grid-v4">
                                                    <div className="vital-input-v4" style={{ gridColumn: '1 / -1' }}>
                                                        <label>Random Sugar <span style={{ color: '#94a3b8', fontWeight: 500 }}>(mg/dL)</span></label>
                                                        <input placeholder="0" value={form.random_sugar} onChange={e => setForm({ ...form, random_sugar: e.target.value })} />
                                                    </div>
                                                    <div className="vital-input-v4">
                                                        <label>Pain Score</label>
                                                        <select value={form.pain_score} onChange={e => setForm({ ...form, pain_score: e.target.value })} style={{ border: 'none', fontSize: '0.9rem', fontWeight: 700, outline: 'none', background: 'transparent', cursor: 'pointer' }}>
                                                            <option value="">—</option>
                                                            {Array.from({ length: 11 }, (_, i) => i).map(n => <option key={n} value={String(n)}>{n}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="vital-input-v4">
                                                        <label>Fall Risk</label>
                                                        <select value={form.fall_risk} onChange={e => setForm({ ...form, fall_risk: e.target.value })} style={{ border: 'none', fontSize: '0.8rem', fontWeight: 700, outline: 'none', background: 'transparent', cursor: 'pointer' }}>
                                                            <option value="">—</option>
                                                            <option value="Low">Low</option>
                                                            <option value="Moderate">Med</option>
                                                            <option value="High">High</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Allergy Section ── */}
                                        <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>

                                            {/* Header row */}
                                            <div className="premium-header-v2">
                                                <div className="title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <AlertTriangle size={15} /> Allergy <span style={{ color: '#dc2626' }}>*</span>
                                                </div>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', color: form.no_known_allergy ? '#0ea5e9' : '#64748b', userSelect: 'none' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!form.no_known_allergy}
                                                        onChange={e => setForm({ ...form, no_known_allergy: e.target.checked, allergies: e.target.checked ? [] : form.allergies })}
                                                        style={{ accentColor: '#0ea5e9', width: '15px', height: '15px' }}
                                                    />
                                                    No Known Allergy
                                                </label>
                                            </div>

                                            {!form.no_known_allergy && (
                                                <>
                                                    {/* Saved allergy chips */}
                                                    {(form.allergies || []).length > 0 && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
                                                            {form.allergies.map((al, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.45rem 0.75rem', background: '#fef9f9', borderRadius: '8px', border: '1px solid #fee2e2', fontSize: '0.8rem' }}>
                                                                    <span style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.68rem', padding: '1px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>{al.category}</span>
                                                                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{al.type || '—'}</span>
                                                                    {al.reaction && <span style={{ color: '#64748b' }}>— {al.reaction}</span>}
                                                                    {al.intensity && (
                                                                        <span style={{ fontWeight: 800, fontSize: '0.72rem', color: al.intensity === 'High' ? '#dc2626' : al.intensity === 'Moderate' ? '#d97706' : '#2563eb' }}>
                                                                            ▲ {al.intensity}
                                                                        </span>
                                                                    )}
                                                                    {al.duration && <span style={{ color: '#94a3b8' }}>• {al.duration}</span>}
                                                                    {al.informed_by && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>| {al.informed_by}</span>}
                                                                    <button type="button" onClick={() => setForm({ ...form, allergies: form.allergies.filter((_, i) => i !== idx) })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Category tabs */}
                                                    <div style={{ display: 'flex', borderBottom: '2px solid #f1f5f9', marginBottom: '1rem' }}>
                                                        {[{ val: 'Drug', label: 'Drugs' }, { val: 'Food', label: 'Food' }, { val: 'Other', label: 'Others' }].map(cat => (
                                                            <button
                                                                key={cat.val}
                                                                type="button"
                                                                onClick={() => setAllergyDraft({ ...allergyDraft, category: cat.val })}
                                                                style={{ padding: '0.45rem 1.1rem', border: 'none', background: 'transparent', fontWeight: allergyDraft.category === cat.val ? 800 : 600, fontSize: '0.85rem', color: allergyDraft.category === cat.val ? '#0ea5e9' : '#64748b', borderBottom: allergyDraft.category === cat.val ? '2.5px solid #0ea5e9' : '2.5px solid transparent', marginBottom: '-2px', cursor: 'pointer', transition: '0.15s' }}
                                                            >
                                                                {cat.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* 2-column label / input grid */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.7rem 1rem', alignItems: 'center' }}>

                                                        {/* Allergy name */}
                                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151' }}>{allergyDraft.category === 'Drug' ? 'Drug' : allergyDraft.category === 'Food' ? 'Food' : 'Other'}</span>
                                                        <input className="input-premium-v4" style={{ fontSize: '0.82rem' }} placeholder={allergyDraft.category === 'Drug' ? 'Type Drug Name' : allergyDraft.category === 'Food' ? 'Type Food Name' : 'Type Other Text'} value={allergyDraft.type} list="allergy-options" onChange={e => setAllergyDraft({ ...allergyDraft, type: e.target.value })} />

                                                        {/* Reaction */}
                                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151' }}>Reaction</span>
                                                        <input className="input-premium-v4" style={{ fontSize: '0.82rem' }} placeholder="e.g. Rash, Swelling, Itching" value={allergyDraft.reaction} onChange={e => setAllergyDraft({ ...allergyDraft, reaction: e.target.value })} />

                                                        {/* Intensity */}
                                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151' }}>Intensity</span>
                                                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                                                            {[{ val: 'Low', color: '#2563eb' }, { val: 'Moderate', color: '#d97706' }, { val: 'High', color: '#dc2626' }].map(opt => (
                                                                <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: allergyDraft.intensity === opt.val ? opt.color : '#64748b', userSelect: 'none' }}>
                                                                    <input type="radio" name="al-intensity" value={opt.val} checked={allergyDraft.intensity === opt.val} onChange={() => setAllergyDraft({ ...allergyDraft, intensity: opt.val })} style={{ accentColor: opt.color }} />
                                                                    {opt.val} <span style={{ color: opt.color, fontWeight: 900, fontSize: '0.8rem' }}>▲</span>
                                                                </label>
                                                            ))}
                                                        </div>

                                                        {/* Duration */}
                                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151' }}>Duration</span>
                                                        <select className="input-premium-v4" style={{ fontSize: '0.82rem' }} value={allergyDraft.duration} onChange={e => setAllergyDraft({ ...allergyDraft, duration: e.target.value })}>
                                                            <option value="">--select--</option>
                                                            <option>Immediate (minutes)</option>
                                                            <option>Hours (1–24 hrs)</option>
                                                            <option>Days (1–7 days)</option>
                                                            <option>Weeks (1–4 weeks)</option>
                                                            <option>Months (1–6 months)</option>
                                                            <option>Chronic / Lifelong</option>
                                                        </select>

                                                        {/* Informed By */}
                                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151', alignSelf: 'flex-start', paddingTop: '0.2rem' }}>Informed By:</span>
                                                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                                                            {['By Patient', 'By Guardian', 'Observed by Doctor'].map(opt => (
                                                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: allergyDraft.informed_by === opt ? '#6366f1' : '#64748b', userSelect: 'none' }}>
                                                                    <input type="radio" name="al-informed-by" value={opt} checked={allergyDraft.informed_by === opt} onChange={() => setAllergyDraft({ ...allergyDraft, informed_by: opt })} style={{ accentColor: '#6366f1' }} />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Save / Clear buttons */}
                                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!allergyDraft.type.trim()) return;
                                                                setForm({ ...form, allergies: [...(form.allergies || []), { ...allergyDraft }] });
                                                                setAllergyDraft({ ...EMPTY_ALLERGY });
                                                            }}
                                                            className="btn-add-item-premium"
                                                        >
                                                            <Plus size={14} /> Save Allergy
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAllergyDraft({ ...EMPTY_ALLERGY })}
                                                            className="btn-clear-item-premium"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* ── Chief Complaints Section ── */}
                                        <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                            <div className="premium-header-v2">
                                                <div className="title">Chief Complaints</div>
                                            </div>

                                            <div className="f-group-premium">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <label style={{ margin: 0 }}>Chief Complaints</label>

                                                </div>
                                                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', background: '#fff' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: form.chief_complaints_list?.length ? '0.5rem' : '0' }}>
                                                        {(form.chief_complaints_list || []).map((cc, idx) => (
                                                            <span key={idx} style={{ background: '#e2e8f0', color: '#475569', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {cc}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const list = [...form.chief_complaints_list];
                                                                        list.splice(idx, 1);
                                                                        setForm({ ...form, chief_complaints_list: list });
                                                                    }}
                                                                    style={{ background: '#94a3b8', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <input
                                                        className="input-premium-v4 cc-placeholder-style"
                                                        style={{ border: 'none', padding: 0, boxShadow: 'none', width: '100%', background: 'transparent' }}
                                                        placeholder="Type Chief Complaints and press Enter"
                                                        list="chief-complaints-options"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const val = e.target.value.trim();
                                                                if (val) {
                                                                    setForm({ ...form, chief_complaints_list: [...(form.chief_complaints_list || []), val] });
                                                                    e.target.value = '';
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="f-group-premium" style={{ marginTop: '1rem' }}>
                                                <label>History of Present Illness</label>
                                                <textarea
                                                    className="textarea-premium-v4 cc-placeholder-style"
                                                    rows={3}
                                                    placeholder="Type History of Present Illness"
                                                    value={form.history_of_present_illness}
                                                    onChange={e => setForm({ ...form, history_of_present_illness: e.target.value })}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                />
                                            </div>
                                        </div>

                                        {/* ── Past History Section ── */}
                                        <div className="form-card-premium" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                                            <div className="premium-header-v2">
                                                <div className="title">Past & Family History</div>
                                            </div>
                                            <div className="f-group-premium">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                    <label style={{ margin: 0 }}>Past History</label>

                                                </div>
                                                <textarea
                                                    className="textarea-premium-v4 cc-placeholder-style"
                                                    rows={3}
                                                    placeholder="Type Past History"
                                                    value={form.past_history}
                                                    onChange={e => setForm({ ...form, past_history: e.target.value })}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                    maxLength={2000}
                                                />
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'left', marginTop: '0.2rem' }}>
                                                    {2000 - (form.past_history?.length || 0)} characters left
                                                </div>
                                            </div>

                                            <div className="f-group-premium">
                                                <label>Personal and Socioeconomic History</label>
                                                <textarea
                                                    className="textarea-premium-v4 cc-placeholder-style"
                                                    rows={3}
                                                    placeholder="Type Personal / Socioeconomic History"
                                                    value={form.personal_history}
                                                    onChange={e => setForm({ ...form, personal_history: e.target.value })}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                />
                                            </div>

                                            <div className="f-group-premium">
                                                <label>Family History</label>
                                                <textarea
                                                    className="textarea-premium-v4 cc-placeholder-style"
                                                    rows={3}
                                                    placeholder="Type Family History"
                                                    value={form.family_history}
                                                    onChange={e => setForm({ ...form, family_history: e.target.value })}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                />
                                            </div>

                                            {/* Family Disease Builder */}
                                            <div style={{ marginTop: '0.5rem' }}>
                                                {form.family_diseases?.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                                                        {form.family_diseases.map((fd, idx) => (
                                                            <span key={idx} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                                                                {fd.disease} - {fd.relationship}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const updated = [...form.family_diseases];
                                                                        updated.splice(idx, 1);
                                                                        setForm({ ...form, family_diseases: updated });
                                                                    }}
                                                                    style={{ background: '#94a3b8', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.8rem', alignItems: 'end' }}>
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Disease</label>
                                                        <select
                                                            className="input-premium-v4"
                                                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem' }}
                                                            value={familyDiseaseDraft.disease}
                                                            onChange={e => setFamilyDiseaseDraft({ ...familyDiseaseDraft, disease: e.target.value })}
                                                        >
                                                            <option value="">Select Disease</option>
                                                            <option value="Diabetes">Diabetes</option>
                                                            <option value="Hypertension">Hypertension</option>
                                                            <option value="Asthma">Asthma</option>
                                                            <option value="Thyroid">Thyroid</option>
                                                            <option value="Heart Disease">Heart Disease</option>
                                                            <option value="Cancer">Cancer</option>
                                                        </select>
                                                    </div>
                                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Relationship</label>
                                                        <select
                                                            className="input-premium-v4"
                                                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem' }}
                                                            value={familyDiseaseDraft.relationship}
                                                            onChange={e => setFamilyDiseaseDraft({ ...familyDiseaseDraft, relationship: e.target.value })}
                                                        >
                                                            <option value="">Select Relationship</option>
                                                            <option value="Father">Father</option>
                                                            <option value="Mother">Mother</option>
                                                            <option value="Paternal Grandfather">Paternal Grandfather</option>
                                                            <option value="Paternal Grandmother">Paternal Grandmother</option>
                                                            <option value="Maternal Grandfather">Maternal Grandfather</option>
                                                            <option value="Maternal Grandmother">Maternal Grandmother</option>
                                                            <option value="Sibling">Sibling</option>
                                                        </select>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (familyDiseaseDraft.disease && familyDiseaseDraft.relationship) {
                                                                setForm({ ...form, family_diseases: [...(form.family_diseases || []), familyDiseaseDraft] });
                                                                setFamilyDiseaseDraft({ disease: '', relationship: '' });
                                                            }
                                                        }}
                                                        className="btn-add-item-premium"
                                                        style={{ height: '38px' }}
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFamilyDiseaseDraft({ disease: '', relationship: '' })}
                                                        className="btn-clear-item-premium"
                                                        style={{ height: '38px' }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Physical Examination Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Physical Examination</div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>General Physical Examination</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', rowGap: '1rem' }}>
                                                {[
                                                    { key: 'pe_pallor', label: 'Pallor' },
                                                    { key: 'pe_icterus', label: 'Icterus' },
                                                    { key: 'pe_oedema', label: 'Oedema' },
                                                    { key: 'pe_lymphadenopathy', label: 'Lymphadenopathy' },
                                                    { key: 'pe_cyanosis', label: 'Cyanosis' },
                                                    { key: 'pe_clubbing', label: 'Clubbing' }
                                                ].map(item => (
                                                    <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>{item.label}</span>
                                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                            {['Yes', 'No'].map(opt => (
                                                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={item.key}
                                                                        value={opt}
                                                                        checked={form[item.key] === opt}
                                                                        onChange={e => setForm({ ...form, [item.key]: e.target.value })}
                                                                        style={{ accentColor: '#0ea5e9' }}
                                                                    />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <label style={{ margin: 0 }}>Physical Examination</label>

                                            </div>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={4}
                                                placeholder="Type Physical Examination"
                                                value={form.physical_examination}
                                                onChange={e => setForm({ ...form, physical_examination: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                maxLength={2000}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'left', marginTop: '0.2rem' }}>
                                                {2000 - (form.physical_examination?.length || 0)} characters left
                                            </div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label>Systemic Examination</label>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={4}
                                                placeholder="Type Systemic Examination"
                                                value={form.systemic_examination}
                                                onChange={e => setForm({ ...form, systemic_examination: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                maxLength={2000}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'left', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{2000 - (form.systemic_examination?.length || 0)} characters left</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setForm({
                                                        ...form,
                                                        pe_pallor: '', pe_icterus: '', pe_oedema: '', pe_lymphadenopathy: '', pe_cyanosis: '', pe_clubbing: '',
                                                        physical_examination: '', systemic_examination: ''
                                                    })}
                                                    style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '0.3rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Annotate Diagram Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Annotate Diagram</div>
                                        </div>
                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <select
                                                className="input-premium-v4 cc-placeholder-style"
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', width: '100%', maxWidth: '400px', color: form.diagram_image ? '#334155' : '#94a3b8' }}
                                                value={form.diagram_image}
                                                onChange={e => setForm({ ...form, diagram_image: e.target.value })}
                                            >
                                                <option value="" disabled hidden>select Image</option>
                                                {masterData.diagrams.map((diagram) => (
                                                    <option key={diagram.id} value={diagram.name} style={{ color: '#334155' }}>
                                                        {diagram.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* ── Clinical Notes/ Old Reports Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Clinical Notes / Old Reports</div>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {masterData.noteTemplates.map(tmpl => (
                                                    <button
                                                        key={tmpl.name}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, clinical_notes: (form.clinical_notes ? form.clinical_notes + '\n' : '') + tmpl.content })}
                                                        style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        + {tmpl.name}
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const name = prompt('Enter template name (e.g. Fever Followup):');
                                                        if (name && form.clinical_notes) {
                                                            await upsertClinicalTemplate({ name, type: 'note', content: form.clinical_notes });
                                                            alert('Template saved!');
                                                            loadMasterData();
                                                        }
                                                    }}
                                                    style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    💾 Save as Template
                                                </button>
                                            </div>
                                        </div>
                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={4}
                                                placeholder="Type Clinical Notes"
                                                value={form.clinical_notes}
                                                onChange={e => setForm({ ...form, clinical_notes: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                            />
                                        </div>
                                    </div>



                                    {/* ── Provisional Diagnosis Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Provisional Diagnosis</div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0, marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <label style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem' }}>Diagnosis</label>

                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="input-premium-v4 cc-placeholder-style"
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', width: '100%' }}
                                                    placeholder="ASTHM"
                                                    value={diagnosisDraft.diagnosis_name}
                                                    list="icd10-options"
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        const matched = masterData.icd10.find((row) => row.name?.toLowerCase() === value.toLowerCase());
                                                        setDiagnosisDraft({ ...diagnosisDraft, diagnosis_name: value, icd_10: matched?.code || diagnosisDraft.icd_10 });
                                                    }}
                                                />
                                                <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '2rem' }}>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.4rem', display: 'block' }}>Stage</label>
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        {['Provisional', 'Final'].map(opt => (
                                                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#0ea5e9', cursor: 'pointer', fontWeight: 600 }}>
                                                                <input
                                                                    type="radio"
                                                                    name="stage"
                                                                    value={opt}
                                                                    checked={diagnosisDraft.stage === opt}
                                                                    onChange={e => setDiagnosisDraft({ ...diagnosisDraft, stage: e.target.value })}
                                                                    style={{ accentColor: '#0ea5e9' }}
                                                                />
                                                                {opt}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="f-group-premium" style={{ margin: 0 }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.4rem', display: 'block' }}>Type</label>
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        {['Primary', 'Secondary'].map(opt => (
                                                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#0ea5e9', cursor: 'pointer', fontWeight: 600 }}>
                                                                <input
                                                                    type="radio"
                                                                    name="type"
                                                                    value={opt}
                                                                    checked={diagnosisDraft.type === opt}
                                                                    onChange={e => setDiagnosisDraft({ ...diagnosisDraft, type: e.target.value })}
                                                                    style={{ accentColor: '#0ea5e9' }}
                                                                />
                                                                {opt}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (diagnosisDraft.diagnosis_name) {
                                                            setForm({ ...form, provisional_diagnoses: [...(form.provisional_diagnoses || []), diagnosisDraft] });
                                                            setDiagnosisDraft({ diagnosis_name: '', icd_10: '', stage: 'Provisional', type: 'Primary', notes: '' });
                                                        }
                                                    }}
                                                    className="btn-add-item-premium"
                                                >
                                                    <Plus size={14} /> Add Diagnosis
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDiagnosisDraft({ diagnosis_name: '', icd_10: '', stage: 'Provisional', type: 'Primary', notes: '' })}
                                                    className="btn-clear-item-premium"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0, marginBottom: '1.5rem' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Diagnosis Notes</label>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={4}
                                                placeholder="-"
                                                value={diagnosisDraft.notes}
                                                onChange={e => setDiagnosisDraft({ ...diagnosisDraft, notes: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                maxLength={10000}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'left', marginTop: '0.2rem' }}>
                                                {10000 - (diagnosisDraft.notes?.length || 0)} characters left
                                            </div>
                                        </div>

                                        {form.provisional_diagnoses?.length > 0 && (
                                            <div style={{ overflowX: 'auto', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ background: '#e0f2fe', color: '#0369a1', textAlign: 'left' }}>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>S.No.</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Diagnosis</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>ICD 10</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Stage</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Type</th>
                                                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #bae6fd' }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.provisional_diagnoses.map((diag, idx) => (
                                                            <tr key={idx}>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>{idx + 1}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{diag.diagnosis_name}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{diag.icd_10 || '-'}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{diag.stage}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{diag.type}</td>
                                                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                        <span style={{ color: '#94a3b8', fontSize: '14px' }}>☆</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const updated = [...form.provisional_diagnoses];
                                                                                updated.splice(idx, 1);
                                                                                setForm({ ...form, provisional_diagnoses: updated });
                                                                            }}
                                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Investigation Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Investigation Advice</div>
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
                                            <div className="f-group-premium" style={{ margin: 0, flex: '1 1 300px' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.4rem', display: 'block' }}>Investigation Advised</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        className="input-premium-v4 cc-placeholder-style"
                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', width: '100%', borderColor: '#ef4444' }}
                                                        placeholder="Investigation Advised"
                                                        value={investigationDraft.name}
                                                        list="investigation-options"
                                                        onChange={e => setInvestigationDraft({ ...investigationDraft, name: e.target.value })}
                                                    />
                                                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                                </div>
                                            </div>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.4rem', display: 'block' }}>Priority</label>
                                                <div style={{ display: 'flex', gap: '1rem', height: '42px', alignItems: 'center' }}>
                                                    {['Routine', 'Stat', 'Follow-up'].map(opt => (
                                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#0ea5e9', cursor: 'pointer', fontWeight: 600 }}>
                                                            <input
                                                                type="radio"
                                                                name="inv_priority"
                                                                value={opt}
                                                                checked={investigationDraft.priority === opt}
                                                                onChange={e => setInvestigationDraft({ ...investigationDraft, priority: e.target.value })}
                                                                style={{ accentColor: '#0ea5e9' }}
                                                            />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', height: '42px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (investigationDraft.name && investigationDraft.priority) {
                                                            setForm({ ...form, investigations_list: [...(form.investigations_list || []), investigationDraft] });
                                                            setInvestigationDraft({ name: '', priority: 'Routine' });
                                                        }
                                                    }}
                                                    className="btn-add-item-premium"
                                                    style={{ height: '42px' }}
                                                >
                                                    <Plus size={14} /> Add
                                                </button>


                                            </div>
                                        </div>

                                        {form.investigations_list?.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                                {form.investigations_list.map((inv, idx) => (
                                                    <span key={idx} style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {inv.name} ({inv.priority})
                                                        <button type="button" onClick={() => { const updated = [...form.investigations_list]; updated.splice(idx, 1); setForm({ ...form, investigations_list: updated }); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Other Investigation</label>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={3}
                                                placeholder="Type Investigation"
                                                value={form.investigations}
                                                onChange={e => setForm({ ...form, investigations: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                            />
                                        </div>
                                    </div>

                                    {/* ── Procedure Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Procedure Advised</div>
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
                                            <div className="f-group-premium" style={{ margin: 0, flex: '1 1 300px' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.4rem', display: 'block' }}>Procedure Advised</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        className="input-premium-v4 cc-placeholder-style"
                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', width: '100%', borderColor: '#ef4444' }}
                                                        placeholder="Procedure Advised"
                                                        value={procedureDraft.name}
                                                        list="procedure-options"
                                                        onChange={e => setProcedureDraft({ ...procedureDraft, name: e.target.value })}
                                                    />
                                                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', height: '42px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (procedureDraft.name) {
                                                            setForm({ ...form, procedures_list: [...(form.procedures_list || []), procedureDraft] });
                                                            setProcedureDraft({ name: '' });
                                                        }
                                                    }}
                                                    className="btn-add-item-premium"
                                                    style={{ height: '42px' }}
                                                >
                                                    <Plus size={14} /> Add
                                                </button>


                                            </div>
                                        </div>

                                        {form.procedures_list?.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                                {form.procedures_list.map((proc, idx) => (
                                                    <span key={idx} style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {proc.name}
                                                        <button type="button" onClick={() => { const updated = [...form.procedures_list]; updated.splice(idx, 1); setForm({ ...form, procedures_list: updated }); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Other Procedure</label>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={3}
                                                placeholder="Type Procedure"
                                                value={form.other_procedure}
                                                onChange={e => setForm({ ...form, other_procedure: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                            />
                                        </div>
                                    </div>

                                    {/* ── Medication History Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Medication History</div>
                                        </div>

                                        <div style={{ overflowX: 'auto', border: '1px solid #bae6fd', borderRadius: '6px', marginBottom: '1rem' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#e0f2fe', color: '#0369a1', textAlign: 'left' }}>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd', width: '40px' }}>S.No</th>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Drug</th>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Form</th>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Dose</th>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Route</th>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Frequency</th>
                                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd', width: '100px' }}>To be Continued</th>
                                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #bae6fd', width: '80px' }}>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.medication_history?.map((med, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '20px', height: '20px', background: '#f1f5f9', borderRadius: '4px' }}>
                                                                    <span style={{ fontSize: '10px' }}>❖</span>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>{med.drug}</td>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{med.form}</td>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{med.dose}</td>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{med.route}</td>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{med.frequency}</td>
                                                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{med.to_be_continued}</td>
                                                            <td style={{ padding: '0.5rem' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const updated = [...form.medication_history];
                                                                        updated.splice(idx, 1);
                                                                        setForm({ ...form, medication_history: updated });
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    <tr>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '20px', height: '20px', background: '#f1f5f9', borderRadius: '4px' }}>
                                                                <span style={{ fontSize: '10px' }}>❖</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd' }}>
                                                            <input
                                                                className="input-premium-v4 cc-placeholder-style"
                                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem', width: '100%' }}
                                                                placeholder="Drug"
                                                                value={medicationHistoryDraft.drug}
                                                                list="medicine-options"
                                                                onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, drug: e.target.value })}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd' }}>
                                                            <select
                                                                className="input-premium-v4 cc-placeholder-style"
                                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem', width: '100%', color: medicationHistoryDraft.form ? '#334155' : '#94a3b8' }}
                                                                value={medicationHistoryDraft.form}
                                                                onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, form: e.target.value })}
                                                            >
                                                                <option value="" disabled hidden>--select--</option>
                                                                <option value="Tablet" style={{ color: '#334155' }}>Tablet</option>
                                                                <option value="Capsule" style={{ color: '#334155' }}>Capsule</option>
                                                                <option value="Syrup" style={{ color: '#334155' }}>Syrup</option>
                                                                <option value="Injection" style={{ color: '#334155' }}>Injection</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd' }}>
                                                            <input
                                                                className="input-premium-v4 cc-placeholder-style"
                                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem', width: '100%' }}
                                                                placeholder="Dose"
                                                                value={medicationHistoryDraft.dose}
                                                                onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, dose: e.target.value })}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd' }}>
                                                            <select
                                                                className="input-premium-v4 cc-placeholder-style"
                                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem', width: '100%', color: medicationHistoryDraft.route ? '#334155' : '#94a3b8' }}
                                                                value={medicationHistoryDraft.route}
                                                                onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, route: e.target.value })}
                                                            >
                                                                <option value="" disabled hidden>--Route--</option>
                                                                <option value="Oral" style={{ color: '#334155' }}>Oral</option>
                                                                <option value="IV" style={{ color: '#334155' }}>IV</option>
                                                                <option value="IM" style={{ color: '#334155' }}>IM</option>
                                                                <option value="Topical" style={{ color: '#334155' }}>Topical</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd' }}>
                                                            <select
                                                                className="input-premium-v4 cc-placeholder-style"
                                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem', width: '100%', color: medicationHistoryDraft.frequency ? '#334155' : '#94a3b8' }}
                                                                value={medicationHistoryDraft.frequency}
                                                                onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, frequency: e.target.value })}
                                                            >
                                                                <option value="" disabled hidden>--Schedule--</option>
                                                                <option value="OD" style={{ color: '#334155' }}>OD</option>
                                                                <option value="BD" style={{ color: '#334155' }}>BD</option>
                                                                <option value="TDS" style={{ color: '#334155' }}>TDS</option>
                                                                <option value="SOS" style={{ color: '#334155' }}>SOS</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', fontSize: '0.8rem' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#0369a1', fontWeight: 600 }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                                    <input type="radio" name="med_continue" value="Yes" checked={medicationHistoryDraft.to_be_continued === 'Yes'} onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, to_be_continued: e.target.value })} /> Yes
                                                                </label>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                                    <input type="radio" name="med_continue" value="No" checked={medicationHistoryDraft.to_be_continued === 'No'} onChange={e => setMedicationHistoryDraft({ ...medicationHistoryDraft, to_be_continued: e.target.value })} /> No
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.5rem' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (medicationHistoryDraft.drug) {
                                                                        setForm({ ...form, medication_history: [...(form.medication_history || []), medicationHistoryDraft] });
                                                                        setMedicationHistoryDraft({ drug: '', form: '', dose: '', route: '', frequency: '', to_be_continued: 'Yes' });
                                                                    }
                                                                }}
                                                                className="btn-add-item-premium"
                                                                style={{ width: '100%', height: '38px', justifyContent: 'center' }}
                                                            >
                                                                Add
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* ── Medication Advice Section ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Medication Advice</div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0, marginBottom: '1.5rem' }}>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={3}
                                                value={form.prescription}
                                                onChange={e => setForm({ ...form, prescription: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div style={{ flex: '1 1 300px' }}>
                                                <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', height: '38px', marginBottom: '0.5rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPrescriptionDraft({ ...prescriptionDraft, type: 'Brand' })}
                                                        style={{ padding: '0 1rem', background: prescriptionDraft.type === 'Brand' ? '#0d9488' : '#fff', color: prescriptionDraft.type === 'Brand' ? '#fff' : '#64748b', border: 'none', borderRight: '1px solid #cbd5e1', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                                                    >
                                                        Brand
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPrescriptionDraft({ ...prescriptionDraft, type: 'Generic' })}
                                                        style={{ padding: '0 1rem', background: prescriptionDraft.type === 'Generic' ? '#0d9488' : '#fff', color: prescriptionDraft.type === 'Generic' ? '#fff' : '#64748b', border: 'none', borderRight: '1px solid #cbd5e1', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                                                    >
                                                        Generic
                                                    </button>
                                                    <div style={{ position: 'relative', flex: 1 }}>
                                                        <input
                                                            className="input-premium-v4 cc-placeholder-style"
                                                            style={{ border: 'none', padding: '0 0.8rem', width: '100%', height: '100%', outline: 'none' }}
                                                            placeholder="ADV"
                                                            value={prescriptionDraft.medicine}
                                                            list="medicine-options"
                                                            onChange={e => setPrescriptionDraft({ ...prescriptionDraft, medicine: e.target.value })}
                                                        />
                                                        <Search size={14} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                                    </div>
                                                </div>
                                                <div style={{ position: 'relative', height: '38px' }}>
                                                    <select
                                                        className="input-premium-v4 cc-placeholder-style"
                                                        style={{ border: '1px solid #ef4444', borderRadius: '6px', padding: '0 0.8rem', width: '100%', height: '100%', color: prescriptionDraft.route ? '#334155' : '#94a3b8', outline: 'none' }}
                                                        value={prescriptionDraft.route}
                                                        onChange={e => setPrescriptionDraft({ ...prescriptionDraft, route: e.target.value })}
                                                    >
                                                        <option value="" disabled hidden>Route</option>
                                                        <option value="ORAL" style={{ color: '#334155' }}>ORAL</option>
                                                        <option value="INHALATION" style={{ color: '#334155' }}>INHALATION</option>
                                                        <option value="IV" style={{ color: '#334155' }}>IV</option>
                                                        <option value="IM" style={{ color: '#334155' }}>IM</option>
                                                        <option value="TOPICAL" style={{ color: '#334155' }}>TOPICAL</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div style={{ width: '160px' }}>
                                                <select
                                                    className="input-premium-v4 cc-placeholder-style"
                                                    style={{ border: '1px solid #ef4444', borderRadius: '6px', padding: '0 0.8rem', width: '100%', height: '38px', color: prescriptionDraft.schedule ? '#334155' : '#94a3b8', outline: 'none', marginBottom: '0.5rem' }}
                                                    value={prescriptionDraft.schedule}
                                                    onChange={e => setPrescriptionDraft({ ...prescriptionDraft, schedule: e.target.value })}
                                                >
                                                    <option value="" disabled hidden>--Schedule--</option>
                                                    <option value="once a day" style={{ color: '#334155' }}>once a day</option>
                                                    <option value="twice a day" style={{ color: '#334155' }}>twice a day</option>
                                                    <option value="thrice a day" style={{ color: '#334155' }}>thrice a day</option>
                                                    <option value="SOS" style={{ color: '#334155' }}>SOS</option>
                                                </select>
                                                {/* Error message placeholder like in image */}
                                                {!prescriptionDraft.schedule && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '-0.3rem', marginBottom: '0.2rem' }}>Value is required.</div>}
                                                <input
                                                    className="input-premium-v4 cc-placeholder-style"
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 0.8rem', width: '100%', height: '38px', outline: 'none' }}
                                                    placeholder="Days"
                                                    type="number"
                                                    value={prescriptionDraft.days}
                                                    onChange={e => setPrescriptionDraft({ ...prescriptionDraft, days: e.target.value })}
                                                />
                                            </div>

                                            <div style={{ flex: '1 1 200px', height: '80px' }}>
                                                <textarea
                                                    className="textarea-premium-v4 cc-placeholder-style"
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', width: '100%', height: '100%', outline: 'none', resize: 'none' }}
                                                    placeholder="Instruction"
                                                    value={prescriptionDraft.instruction}
                                                    onChange={e => setPrescriptionDraft({ ...prescriptionDraft, instruction: e.target.value })}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.5rem', height: '38px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (prescriptionDraft.medicine && prescriptionDraft.schedule) {
                                                            setForm({ ...form, prescriptions_list: [...(form.prescriptions_list || []), prescriptionDraft] });
                                                            setPrescriptionDraft({ type: 'Brand', medicine: '', schedule: '', instruction: '', days: '', route: '' });
                                                        }
                                                    }}
                                                    className="btn-add-item-premium"
                                                    style={{ height: '38px' }}
                                                >
                                                    <Plus size={14} /> Add
                                                </button>


                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Change day for all medicine</span>
                                            <input
                                                type="number"
                                                className="input-premium-v4 cc-placeholder-style"
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.5rem', width: '60px', height: '32px', outline: 'none' }}
                                                placeholder="Days"
                                                value={globalDays}
                                                onChange={e => setGlobalDays(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (globalDays && form.prescriptions_list) {
                                                        const updated = form.prescriptions_list.map(p => ({ ...p, days: globalDays }));
                                                        setForm({ ...form, prescriptions_list: updated });
                                                        setGlobalDays('');
                                                    }
                                                }}
                                                className="btn-add-item-premium"
                                                style={{ height: '32px', background: '#0d9488' }}
                                            >
                                                Set Day
                                            </button>
                                        </div>

                                        {form.prescriptions_list?.length > 0 && (
                                            <div style={{ overflowX: 'auto', border: '1px solid #bae6fd', borderRadius: '6px', marginBottom: '1.5rem' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ background: '#e0f2fe', color: '#0369a1', textAlign: 'left' }}>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd', width: '40px' }}>S.No</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Medicine</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Schedule</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>Instruction</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd', width: '60px' }}>Days</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd', width: '100px' }}>Route</th>
                                                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #bae6fd', width: '80px' }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.prescriptions_list.map((med, idx) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0' }}>{idx + 1}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{med.medicine}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0' }}>
                                                                    <select
                                                                        className="input-premium-v4 cc-placeholder-style"
                                                                        style={{ border: 'none', background: 'transparent', width: '100%', color: '#475569', outline: 'none' }}
                                                                        value={med.schedule}
                                                                        onChange={e => {
                                                                            const updated = [...form.prescriptions_list];
                                                                            updated[idx].schedule = e.target.value;
                                                                            setForm({ ...form, prescriptions_list: updated });
                                                                        }}
                                                                    >
                                                                        <option value="once a day">once a day</option>
                                                                        <option value="twice a day">twice a day</option>
                                                                        <option value="thrice a day">thrice a day</option>
                                                                        <option value="SOS">SOS</option>
                                                                    </select>
                                                                </td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0' }}>
                                                                    <input
                                                                        className="input-premium-v4 cc-placeholder-style"
                                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem', width: '100%', color: '#475569' }}
                                                                        value={med.instruction}
                                                                        onChange={e => {
                                                                            const updated = [...form.prescriptions_list];
                                                                            updated[idx].instruction = e.target.value;
                                                                            setForm({ ...form, prescriptions_list: updated });
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0' }}>
                                                                    <input
                                                                        type="number"
                                                                        className="input-premium-v4 cc-placeholder-style"
                                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem', width: '100%', color: '#475569', textAlign: 'center' }}
                                                                        value={med.days}
                                                                        onChange={e => {
                                                                            const updated = [...form.prescriptions_list];
                                                                            updated[idx].days = e.target.value;
                                                                            setForm({ ...form, prescriptions_list: updated });
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0' }}>
                                                                    <input
                                                                        className="input-premium-v4 cc-placeholder-style"
                                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem', width: '100%', color: '#475569' }}
                                                                        value={med.route}
                                                                        onChange={e => {
                                                                            const updated = [...form.prescriptions_list];
                                                                            updated[idx].route = e.target.value;
                                                                            setForm({ ...form, prescriptions_list: updated });
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '0.5rem' }}>
                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                        <span style={{ color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>☆</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const updated = [...form.prescriptions_list];
                                                                                updated.splice(idx, 1);
                                                                                setForm({ ...form, prescriptions_list: updated });
                                                                            }}
                                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block', color: '#334155' }}>Other Medication</label>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={3}
                                                placeholder="Type Other Medication"
                                                value={form.other_medication}
                                                onChange={e => setForm({ ...form, other_medication: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* ── Visit Context & Analytics ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Visit Context & Consents</div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                                            <div style={{ flex: 1, minWidth: '300px' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Visit Reason Tags</label>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {['Fever', 'Cough/Cold', 'Vaccination', 'Follow-up', 'Growth check', 'Newborn Screening'].map(tag => (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => {
                                                                const tags = form.visit_tags || [];
                                                                setForm({ ...form, visit_tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] });
                                                            }}
                                                            style={{
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                border: '1px solid #cbd5e1',
                                                                background: form.visit_tags?.includes(tag) ? '#0ea5e9' : '#fff',
                                                                color: form.visit_tags?.includes(tag) ? '#fff' : '#64748b',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '300px' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Consents & Acknowledgements</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {(form.consents || []).map((c, idx) => (
                                                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={c.is_accepted}
                                                                onChange={e => {
                                                                    const updated = [...form.consents];
                                                                    updated[idx].is_accepted = e.target.checked;
                                                                    setForm({ ...form, consents: updated });
                                                                }}
                                                                style={{ width: '16px', height: '16px', accentColor: '#0ea5e9' }}
                                                            />
                                                            {c.consent_type}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Structured Care Advice ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Structured Parent Instructions</div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            {[
                                                { label: 'Home Care Instructions', key: 'advice_home_care', placeholder: 'e.g. Keep well hydrated, sponge baths...' },
                                                { label: 'Diet Advice', key: 'advice_diet', placeholder: 'e.g. Small frequent meals, coconut water...' },
                                                { label: 'Warning Signs (Return if...)', key: 'advice_warning_signs', placeholder: 'e.g. Fever > 2 days, difficulty breathing...' }
                                            ].map(field => (
                                                <div key={field.key} className="f-group-premium" style={{ margin: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                        <label style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>{field.label}</label>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const name = prompt(`Save as ${field.label} template:`);
                                                                if (name && form[field.key]) {
                                                                    await upsertClinicalTemplate({ name, type: 'advice', content: form[field.key] });
                                                                    alert('Template saved!');
                                                                    loadMasterData();
                                                                }
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            + Save as Template
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                                        {masterData.adviceTemplates.map(tmpl => (
                                                            <button
                                                                key={tmpl.name}
                                                                type="button"
                                                                onClick={() => setForm({ ...form, [field.key]: (form[field.key] ? form[field.key] + '\n' : '') + tmpl.content })}
                                                                style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                                            >
                                                                + {tmpl.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                        className="textarea-premium-v4 cc-placeholder-style"
                                                        rows={2}
                                                        placeholder={field.placeholder}
                                                        value={form[field.key]}
                                                        onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="f-group-premium" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', color: '#334155' }}>Admission Status <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span></label>
                                            <select
                                                className="input-premium-v4 cc-placeholder-style"
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', width: '100%', outline: 'none', color: '#475569' }}
                                                value={form.admission_status || 'Not-Required'}
                                                onChange={e => setForm({ ...form, admission_status: e.target.value })}
                                            >
                                                <option value="Not-Required">Not-Required</option>
                                                <option value="Required">Required</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* ── Follow-up & Referral Section ── */}
                                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                        <div className="f-group-premium" style={{ width: '250px', margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block', color: '#334155' }}>Next Follow up Date</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="date"
                                                    className="input-premium-v4 cc-placeholder-style"
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.6rem 0.6rem 0.6rem 2.5rem', width: '100%', outline: 'none', color: '#475569' }}
                                                    value={form.next_visit_due}
                                                    onChange={e => setForm({ ...form, next_visit_due: e.target.value })}
                                                />
                                                <Calendar size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                            </div>
                                        </div>
                                        <div className="f-group-premium" style={{ flex: 1, margin: 0, minWidth: '300px' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block', color: '#334155' }}>Follow up Advice</label>
                                            <textarea
                                                className="textarea-premium-v4 cc-placeholder-style"
                                                rows={3}
                                                placeholder="Type Follow up Advice"
                                                value={form.followup_advice}
                                                onChange={e => setForm({ ...form, followup_advice: e.target.value })}
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', padding: '0.6rem', outline: 'none', resize: 'vertical', minHeight: '62px' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '1rem', display: 'block', color: '#334155' }}>Referral Section</label>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', width: '70px' }}>Location</label>
                                                    <select
                                                        className="input-premium-v4 cc-placeholder-style"
                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.5rem', width: '100%', outline: 'none', color: referralDraft.location ? '#334155' : '#94a3b8' }}
                                                        value={referralDraft.location}
                                                        onChange={e => setReferralDraft({ ...referralDraft, location: e.target.value })}
                                                    >
                                                        <option value="" disabled hidden>select</option>
                                                        {referralTargets
                                                            .filter((target) => target.type === 'hospital')
                                                            .map((target) => (
                                                                <option key={target.id} value={target.name} style={{ color: '#334155' }}>
                                                                    {target.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', width: '70px' }}>Speciality</label>
                                                    <div style={{ width: '100%' }}>
                                                        <select
                                                            className="input-premium-v4 cc-placeholder-style"
                                                            style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.5rem', width: '100%', outline: 'none', color: referralDraft.speciality ? '#334155' : '#94a3b8' }}
                                                            value={referralDraft.speciality}
                                                            onChange={e => setReferralDraft({ ...referralDraft, speciality: e.target.value })}
                                                        >
                                                            <option value="" disabled hidden>select</option>
                                                            {[...new Set(referralTargets
                                                                .filter((target) => target.type === 'specialist' && target.speciality)
                                                                .map((target) => target.speciality))]
                                                                .map((speciality) => (
                                                                    <option key={speciality} value={speciality} style={{ color: '#334155' }}>
                                                                        {speciality}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                        {!referralDraft.speciality && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '0.2rem' }}>Value is required.</div>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', width: '60px' }}>Doctor</label>
                                                    <select
                                                        className="input-premium-v4 cc-placeholder-style"
                                                        style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.5rem', width: '100%', outline: 'none', color: referralDraft.doctor ? '#334155' : '#94a3b8' }}
                                                        value={referralDraft.doctor}
                                                        onChange={e => setReferralDraft({ ...referralDraft, doctor: e.target.value })}
                                                    >
                                                        <option value="" disabled hidden>select</option>
                                                        {referralTargets
                                                            .filter((target) => target.type === 'specialist' && (!referralDraft.speciality || target.speciality === referralDraft.speciality))
                                                            .map((target) => (
                                                                <option key={target.id} value={target.name} style={{ color: '#334155' }}>
                                                                    {target.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (referralDraft.location || referralDraft.speciality || referralDraft.doctor) {
                                                        setForm({ ...form, referrals_list: [...(form.referrals_list || []), referralDraft] });
                                                        setReferralDraft({ location: '', speciality: '', doctor: '' });
                                                    }
                                                }}
                                                className="btn-add-item-premium"
                                                style={{ padding: '0.5rem 2.5rem' }}
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {form.referrals_list?.length > 0 && (
                                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '1rem' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>Location</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>Speciality</th>
                                                            <th style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>Doctor</th>
                                                            <th style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0', width: '60px' }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.referrals_list.map((ref, idx) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{ref.location}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{ref.speciality}</td>
                                                                <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{ref.doctor}</td>
                                                                <td style={{ padding: '0.5rem' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const updated = [...form.referrals_list];
                                                                            updated.splice(idx, 1);
                                                                            setForm({ ...form, referrals_list: updated });
                                                                        }}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Additional Information ── */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div className="f-group-premium" style={{ margin: 0, marginBottom: '1.5rem' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block', color: '#334155' }}>Intent of Treatment</label>
                                            <select
                                                className="input-premium-v4 cc-placeholder-style"
                                                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.6rem', width: '100%', outline: 'none', color: form.intent_of_treatment ? '#334155' : '#94a3b8' }}
                                                value={form.intent_of_treatment}
                                                onChange={e => setForm({ ...form, intent_of_treatment: e.target.value })}
                                            >
                                                <option value="" disabled hidden></option>
                                                <option value="Curative" style={{ color: '#334155' }}>Curative</option>
                                                <option value="Palliative" style={{ color: '#334155' }}>Palliative</option>
                                                <option value="Symptomatic" style={{ color: '#334155' }}>Symptomatic</option>
                                            </select>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0, marginBottom: '1.5rem' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block', color: '#334155' }}>Refer Case to Tumor Board</label>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0369a1', fontSize: '0.9rem', cursor: 'pointer' }}>
                                                    <input type="radio" name="tumorBoard" value="Yes" checked={form.refer_to_tumor_board === 'Yes'} onChange={() => setForm({ ...form, refer_to_tumor_board: 'Yes' })} style={{ accentColor: '#0ea5e9' }} /> Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0369a1', fontSize: '0.9rem', cursor: 'pointer' }}>
                                                    <input type="radio" name="tumorBoard" value="No" checked={form.refer_to_tumor_board === 'No'} onChange={() => setForm({ ...form, refer_to_tumor_board: 'No' })} style={{ accentColor: '#0ea5e9' }} /> No
                                                </label>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Nutrition Advice</label>
                                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                    {['Yes', 'No'].map(opt => (
                                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: form.nutrition_advice === opt ? '#6366f1' : '#64748b' }}>
                                                            <input type="radio" name="nutrition" value={opt} checked={form.nutrition_advice === opt} onChange={() => setForm({ ...form, nutrition_advice: opt })} style={{ accentColor: '#6366f1', width: '16px', height: '16px' }} /> {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Psychology Advice</label>
                                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                    {['Yes', 'No'].map(opt => (
                                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: form.psychology_advice === opt ? '#6366f1' : '#64748b' }}>
                                                            <input type="radio" name="psychology" value={opt} checked={form.psychology_advice === opt} onChange={() => setForm({ ...form, psychology_advice: opt })} style={{ accentColor: '#6366f1', width: '16px', height: '16px' }} /> {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Physiotherapy Advice</label>
                                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                    {['Yes', 'No'].map(opt => (
                                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: form.physiotherapy_advice === opt ? '#6366f1' : '#64748b' }}>
                                                            <input type="radio" name="physiotherapy" value={opt} checked={form.physiotherapy_advice === opt} onChange={() => setForm({ ...form, physiotherapy_advice: opt })} style={{ accentColor: '#6366f1', width: '16px', height: '16px' }} /> {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="f-group-premium" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Complex Care</label>
                                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                    {['Yes', 'No'].map(opt => (
                                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: form.complex_care === opt ? '#6366f1' : '#64748b' }}>
                                                            <input type="radio" name="complex" value={opt} checked={form.complex_care === opt} onChange={() => setForm({ ...form, complex_care: opt })} style={{ accentColor: '#6366f1', width: '16px', height: '16px' }} /> {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'block', color: '#334155' }}>Additional Remarks (Non-Printable)</label>
                                        </div>
                                    </div>

                                    {/* ── Visit Reasons & Consents ── */}
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title">Visit Context & Consents</div>
                                        </div>
                                        
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>Visit Reason Tags (Analytics)</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {['Fever', 'Vaccination', 'Follow-up', 'Growth check', 'Cough/Cold', 'Injury'].map(tag => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => {
                                                            const tags = form.visit_tags || [];
                                                            if (tags.includes(tag)) {
                                                                setForm({ ...form, visit_tags: tags.filter(t => t !== tag) });
                                                            } else {
                                                                setForm({ ...form, visit_tags: [...tags, tag] });
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '0.4rem 1rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            background: (form.visit_tags || []).includes(tag) ? '#0284c7' : '#f1f5f9',
                                                            color: (form.visit_tags || []).includes(tag) ? '#fff' : '#64748b',
                                                            border: '1px solid',
                                                            borderColor: (form.visit_tags || []).includes(tag) ? '#0284c7' : '#e2e8f0'
                                                        }}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '1rem' }}>Patient Consents & Acknowledgements</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {(form.consents || []).map((consent, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={consent.is_accepted}
                                                            onChange={e => {
                                                                const updated = [...form.consents];
                                                                updated[idx].is_accepted = e.target.checked;
                                                                updated[idx].accepted_at = e.target.checked ? new Date().toISOString() : null;
                                                                setForm({ ...form, consents: updated });
                                                            }}
                                                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0ea5e9' }}
                                                        />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{consent.consent_type}</div>
                                                            {consent.is_accepted && (
                                                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Accepted on {new Date(consent.accepted_at).toLocaleString()}</div>
                                                            )}
                                                        </div>
                                                        {consent.is_accepted && (
                                                            <input
                                                                type="text"
                                                                placeholder="Witness Name"
                                                                value={consent.witness_name || ''}
                                                                onChange={e => {
                                                                    const updated = [...form.consents];
                                                                    updated[idx].witness_name = e.target.value;
                                                                    setForm({ ...form, consents: updated });
                                                                }}
                                                                style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', width: '150px' }}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Vitals & Attachments */}
                                <div className="col-span-12">


                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                                        <div className="premium-header-v2">
                                            <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Paperclip size={16} /> Attachments
                                            </div>
                                        </div>
                                        <div className="attachment-grid-premium">
                                            {form.attachments?.map((att, idx) => (
                                                <div key={idx} className="att-preview-premium">
                                                    {att.file_type === 'application/pdf' ? (
                                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#64748b', background: '#f8fafc' }}>
                                                            <FileText size={24} />
                                                            <span style={{ fontSize: '0.7rem', textAlign: 'center', padding: '0 0.35rem' }}>{att.name}</span>
                                                        </div>
                                                    ) : (
                                                        <img src={att.preview} alt="preview" />
                                                    )}
                                                    <button type="button" onClick={() => removeAttachment(idx)} className="rem-btn-premium"><X size={10} /></button>
                                                </div>
                                            ))}
                                            <label className="att-upload-btn-premium">
                                                <Plus size={20} />
                                                <input type="file" multiple accept="image/*,.pdf,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                                            </label>
                                        </div>
                                    </div>


                                </div>
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
                            {formStatus.error && <p className="error-msg" style={{ marginTop: '1rem' }}>{formStatus.error}</p>}
                            {formStatus.success && <p className="success-msg" style={{ marginTop: '1rem' }}>{formStatus.success}</p>}
                        </form>

                        <footer className="modal-footer-v3" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '1.25rem 2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderRadius: '0 0 24px 24px' }}>
                            <button type="button" onClick={() => setShowModal(false)} className="btn-cancel-v3">Discard</button>
                            <button type="button" onClick={handleAddEntry} className="btn-save-v3" style={{ minWidth: '160px', height: '48px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <RefreshCw size={18} className={saving ? 'spinning' : ''} style={{ display: saving ? 'block' : 'none' }} />
                                {saving ? 'Finalizing...' : 'Save & Close'}
                            </button>
                        </footer>

                    </div>
                </div>
            )}

        </div>
    );
};

export default ClinicalEntry;
