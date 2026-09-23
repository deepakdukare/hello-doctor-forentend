import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus,
    Search,
    Trash2,
    Edit2,
    Check,
    X,
    Loader2,
    Stethoscope,
    Activity,
    Beaker,
    AlertCircle,
    Save,
    RefreshCw,
    ClipboardList,
    UploadCloud,
    FileSpreadsheet,
    Info,
    Eye,
    Pill,
    CheckCircle2,
    Download,
    ExternalLink,
    Image as ImageIcon,
    HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getMasterData, upsertMasterData, bulkUpsertMasterData, deleteMasterData, clearCategoryMasterData } from '../api';

const CATEGORIES = [
    { id: 'medicine', name: 'Medicines', icon: Stethoscope, color: '#6366f1' },
    { id: 'investigation', name: 'Investigations', icon: Beaker, color: '#10b981' },
    { id: 'procedure', name: 'Procedures', icon: Activity, color: '#f59e0b' },
    { id: 'diagnosis', name: 'Diagnosis (ICD-10)', icon: ClipboardList, color: '#8b5cf6' },
    { id: 'complaint', name: 'Chief Complaints', icon: AlertCircle, color: '#ef4444' },
    { id: 'allergy', name: 'Allergies', icon: AlertCircle, color: '#ec4899' }
];

const parseSafetyStatus = (val) => {
    if (!val) return { status: null, desc: '', raw: '' };
    const raw = String(val).trim();
    const cleanText = raw.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();

    let status = null;
    let desc = '';
    const upper = cleanText.toUpperCase();

    if (upper.startsWith('CONSULT YOUR DOCTOR')) {
        status = 'CONSULT YOUR DOCTOR';
        desc = cleanText.slice('CONSULT YOUR DOCTOR'.length).trim();
    } else if (upper.startsWith('UNSAFE')) {
        status = 'UNSAFE';
        desc = cleanText.slice('UNSAFE'.length).trim();
    } else if (upper.startsWith('SAFE IF PRESCRIBED')) {
        status = 'SAFE IF PRESCRIBED';
        desc = cleanText.slice('SAFE IF PRESCRIBED'.length).trim();
    } else if (upper.startsWith('SAFE')) {
        status = 'SAFE';
        desc = cleanText.slice('SAFE'.length).trim();
    } else if (upper.startsWith('CAUTION')) {
        status = 'CAUTION';
        desc = cleanText.slice('CAUTION'.length).trim();
    } else {
        desc = cleanText;
    }

    desc = desc.replace(/^[:\-–—\s]+/, '').trim();

    // Clear desc if it is identical to status or empty to prevent repeating the text
    if (status && desc && desc.toUpperCase() === status.toUpperCase()) {
        desc = '';
    }

    return { status, desc, raw: cleanText };
};

const parseSafetyInteractions = (str) => {
    if (!str || typeof str !== 'string') return {};
    const interactions = {};
    const sections = str.split(/\s*\|\s*-?\s*|\n+/);
    for (const sec of sections) {
        const cleaned = sec.replace(/^-\s*/, '').trim();
        const colonIdx = cleaned.indexOf(':');
        if (colonIdx === -1) continue;
        const key = cleaned.slice(0, colonIdx).trim().toLowerCase();
        const val = cleaned.slice(colonIdx + 1).trim();

        if (key.includes('alcohol')) {
            interactions.alcohol_interaction = val;
            interactions.alcoholInteraction = val;
        } else if (key.includes('pregnan')) {
            interactions.pregnancy_interaction = val;
            interactions.pregnancyInteraction = val;
        } else if (key.includes('breast') || key.includes('lactat')) {
            interactions.lactation_interaction = val;
            interactions.lactationInteraction = val;
        } else if (key.includes('driv')) {
            interactions.driving_interaction = val;
            interactions.drivingInteraction = val;
        } else if (key.includes('kidney')) {
            interactions.kidney_interaction = val;
            interactions.kidneyInteraction = val;
        } else if (key.includes('liver')) {
            interactions.liver_interaction = val;
            interactions.liverInteraction = val;
        }
    }
    return interactions;
};

const getStatusBadgeStyle = (status) => {
    switch (status) {
        case 'UNSAFE':
            return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' };
        case 'CAUTION':
            return { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' };
        case 'CONSULT YOUR DOCTOR':
            return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
        case 'SAFE':
        case 'SAFE IF PRESCRIBED':
            return { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' };
        default:
            return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }
};

const renderSafetyCell = (value) => {
    if (!value) return <span style={{ color: '#94a3b8' }}>-</span>;
    const { status, desc, raw } = parseSafetyStatus(value);
    const style = getStatusBadgeStyle(status);

    if (!status && !desc) return <span style={{ color: '#94a3b8' }}>-</span>;

    return (
        <div style={{ maxWidth: '220px', display: 'flex', flexDirection: 'column', gap: '3px' }} title={raw}>
            {status && (
                <span style={{
                    alignSelf: 'flex-start',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: style.bg,
                    color: style.color,
                    border: `1px solid ${style.border}`,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.3px'
                }}>
                    {status}
                </span>
            )}
            {desc ? (
                <span style={{
                    fontSize: '11px',
                    color: '#475569',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3
                }}>
                    {desc}
                </span>
            ) : null}
        </div>
    );
};

const extractImageUrls = (input) => {
    if (!input) return [];
    const val = (typeof input === 'string' || Array.isArray(input))
        ? input
        : (input.image_urls || input['Image_Urls'] || input.Image_Urls || input['image_urls'] || input['Image URL'] || input['Image Url'] || input.image_url || input.images || input.Images || input.image || input.Image || input['Image Links'] || input['Image Link'] || input.photos || input.photo);
    if (!val) return [];

    if (Array.isArray(val)) {
        return val.flatMap(v => extractImageUrls(v));
    }

    let s = String(val).trim();
    if (!s || s.toLowerCase().startsWith('store') || s.toLowerCase().includes('°c') || s.toLowerCase().includes('degree')) return [];

    // Parse JSON or Python-style list with single quotes
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
        try {
            const parsed = JSON.parse(s.replace(/'/g, '"'));
            if (Array.isArray(parsed)) {
                return parsed.map(x => String(x).trim().replace(/[,;]+$/, '')).filter(Boolean);
            }
        } catch (e) { }
    }

    // Match all http/https URLs cleanly
    const matches = s.match(/https?:\/\/[^\s'"<>\]\)]+/g);
    if (matches && matches.length > 0) {
        return [...new Set(matches.map(m => m.replace(/[,;]+$/, '').trim()))];
    }

    return s.split(/[|\n]/)
        .map(x => x.trim().replace(/^['"\[]|['"\]]$/g, '').replace(/[,;]+$/, ''))
        .filter(x => x && (x.startsWith('http') || x.endsWith('.jpg') || x.endsWith('.png') || x.endsWith('.webp') || x.endsWith('.jpeg')));
};

// Structured parser for Q_A (Questions & Answers)
// Handles separators: |, \n, :::, ::, ?, comma, Q./A., Q:/A.
const parseQA = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) {
        return val.map(item => {
            if (typeof item === 'object' && item !== null) {
                return {
                    question: String(item.question || item.q || '').trim(),
                    answer: String(item.answer || item.a || item.ans || '').trim()
                };
            }
            return { question: 'FAQ', answer: String(item).trim() };
        }).filter(x => x.question || x.answer);
    }

    const s = String(val).trim();
    if (!s) return [];

    // Parse JSON if stored as serialized array
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return parseQA(parsed);
        } catch (e) { }
    }

    // Split by pipe '|', multiple newlines, or comma if followed by a new question
    let items = [];
    if (s.includes('|')) {
        items = s.split(/\s*\|\s*/);
    } else if (s.includes('\n')) {
        items = s.split(/\n+/);
    } else if (/:::[^:]+,\s*[A-Z]/.test(s)) {
        items = s.split(/,\s*(?=[^,]+:::)/);
    } else if (/(?<=[.!?])\s+(?=[A-Z][^?]*\?)/.test(s)) {
        items = s.split(/(?<=[.!?])\s+(?=[A-Z][^?]*\?)/);
    } else if (/(?:Q\d*[:.-]|Q\.\s*)/i.test(s)) {
        items = s.split(/(?=(?:Q\d*[:.-]|Q\.\s*))/i);
    } else {
        items = [s];
    }

    items = items.map(x => x.trim()).filter(Boolean);
    const parsed = [];

    for (const item of items) {
        let question = '';
        let answer = '';

        if (item.includes(':::')) {
            const parts = item.split(':::');
            question = parts[0].trim();
            answer = parts.slice(1).join(':::').trim();
        } else if (item.includes('::')) {
            const parts = item.split('::');
            question = parts[0].trim();
            answer = parts.slice(1).join('::').trim();
        } else if (item.includes('?')) {
            const qIdx = item.indexOf('?');
            question = item.slice(0, qIdx + 1).trim();
            answer = item.slice(qIdx + 1).replace(/^[:\-–—\s]+/, '').trim();
        } else if (/^Q\d*[:.-]\s*/i.test(item)) {
            const match = item.match(/^Q\d*[:.-]\s*(.+?)(?:A\d*[:.-]\s*(.+)|$)/is);
            if (match) {
                question = (match[1] || '').trim();
                answer = (match[2] || '').trim();
            } else {
                question = item;
            }
        } else {
            question = 'FAQ';
            answer = item;
        }

        question = question.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
        answer = answer.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();

        if (question || answer) {
            parsed.push({ question, answer });
        }
    }

    return parsed;
};

// Structured parser and deduplicator for drug-drug Interaction
// Handles separators: |, \n, ;, comma, ::, :::, - Drug: Severity <p> Details
const parseDrugInteractions = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    const s = String(val).trim();
    if (!s) return [];

    let rawItems = [];
    if (s.includes('|')) {
        rawItems = s.split(/\s*\|\s*/);
    } else if (s.includes('\n')) {
        rawItems = s.split(/\n+/);
    } else if (/[,;]\s*-(?=[A-Z])/.test(s)) {
        rawItems = s.split(/[,;]\s*(?=-[A-Z])/);
    } else if (/-\s*[A-Z][a-zA-Z0-9\s()]+:/.test(s)) {
        rawItems = s.split(/(?=-\s*[A-Z][a-zA-Z0-9\s()]+:)/);
    } else if (s.includes(';') && s.includes(':')) {
        rawItems = s.split(/\s*;\s*/);
    } else {
        rawItems = [s];
    }

    rawItems = rawItems.map(x => x.trim()).filter(Boolean);
    const drugMap = new Map();

    for (const item of rawItems) {
        let text = item.replace(/^-\s*/, '').replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        let drugName = '';
        let severity = '';
        let details = '';

        let colonIdx = -1;
        let sepLen = 1;
        if (text.includes(':::')) {
            colonIdx = text.indexOf(':::');
            sepLen = 3;
        } else if (text.includes('::')) {
            colonIdx = text.indexOf('::');
            sepLen = 2;
        } else if (text.indexOf(':') !== -1) {
            colonIdx = text.indexOf(':');
            sepLen = 1;
        }

        if (colonIdx !== -1) {
            drugName = text.slice(0, colonIdx).trim();
            const rest = text.slice(colonIdx + sepLen).trim();
            const upper = rest.toUpperCase();

            if (upper.startsWith('SEVERE')) {
                severity = 'Severe';
                details = rest.slice(6).trim();
            } else if (upper.startsWith('MODERATE')) {
                severity = 'Moderate';
                details = rest.slice(8).trim();
            } else if (upper.startsWith('MILD')) {
                severity = 'Mild';
                details = rest.slice(4).trim();
            } else if (upper.startsWith('MINOR')) {
                severity = 'Minor';
                details = rest.slice(5).trim();
            } else if (upper.startsWith('CAUTION')) {
                severity = 'Caution';
                details = rest.slice(7).trim();
            } else {
                details = rest;
            }
        } else {
            drugName = text;
            details = '';
        }

        details = details.replace(/^[:\-–—\s]+/, '').trim();
        const normKey = drugName.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!drugMap.has(normKey) || details.length > (drugMap.get(normKey).details || '').length) {
            drugMap.set(normKey, { drugName, severity, details });
        }
    }

    return Array.from(drugMap.values());
};

const getSeverityBadgeStyle = (severity) => {
    const s = String(severity || '').toUpperCase();
    if (s.includes('SEVERE')) return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' };
    if (s.includes('MODERATE')) return { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' };
    if (s.includes('MILD') || s.includes('MINOR')) return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
    return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
};

// Structured parser for Fact_Box (Pharmaceutical Classification)
// Handles separators: |, \n, comma, ::, :::, :
const parseFactBox = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    const s = String(val).trim();
    if (!s) return [];

    let items = [];
    if (s.includes('|')) {
        items = s.split(/\s*\|\s*/);
    } else if (s.includes('\n')) {
        items = s.split(/\n+/);
    } else if (/,\s*(?=[A-Z][a-zA-Z\s]+::)/.test(s)) {
        items = s.split(/,\s*(?=[A-Z][a-zA-Z\s]+::)/);
    } else if (s.includes(';')) {
        items = s.split(/\s*;\s*/);
    } else {
        items = [s];
    }

    items = items.map(x => x.trim()).filter(Boolean);
    const parsed = [];

    for (const item of items) {
        let label = '';
        let value = '';

        if (item.includes(':::')) {
            const parts = item.split(/:::+/);
            label = parts[0].trim();
            value = parts.slice(1).join(':::').trim();
        } else if (item.includes('::')) {
            const parts = item.split(/::+/);
            label = parts[0].trim();
            value = parts.slice(1).join('::').trim();
        } else if (item.includes(':')) {
            const colonIdx = item.indexOf(':');
            label = item.slice(0, colonIdx).trim();
            value = item.slice(colonIdx + 1).trim();
        } else if (item.includes('-')) {
            const dashIdx = item.indexOf('-');
            label = item.slice(0, dashIdx).trim();
            value = item.slice(dashIdx + 1).trim();
        } else {
            label = 'Fact';
            value = item.trim();
        }

        label = label.replace(/^-\s*/, '').replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
        value = value.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();

        if (label || value) {
            parsed.push({ label, value });
        }
    }

    return parsed;
};

// Structured parser for How it works (Mechanism of Action)
// Handles separators: |, \n, ;, bullet points - / •, sentences
const parseHowItWorks = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    const s = String(val).trim();
    if (!s) return [];

    let parts = [];
    if (s.includes('|')) {
        parts = s.split(/\s*\|\s*/);
    } else if (s.includes('\n')) {
        parts = s.split(/\n+/);
    } else if (/;\s*(?=[A-Z])/.test(s)) {
        parts = s.split(/;\s*(?=[A-Z])/);
    } else if (/(?<=\.)\s+(?=[A-Z])/.test(s) && s.length > 150) {
        parts = s.split(/(?<=\.)\s+(?=[A-Z])/);
    } else {
        parts = [s];
    }

    return parts
        .map(p => p.replace(/^[-•*]\s*/, '').replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
};

// Structured parser for side_effect (Adverse Effects)
// Handles separators: |, comma, \n, ;
const parseSideEffects = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    const s = String(val).trim();
    if (!s) return [];
    return s.split(/\s*\|\s*|\s*,\s*|\n+|;\s*/)
        .map(x => x.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
};

// Structured parser for primary_use / indications
// Handles separators: |, comma, \n, ;
const parsePrimaryUse = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    const s = String(val).trim();
    if (!s) return [];
    return s.split(/\s*\|\s*|\s*,\s*|\n+|;\s*/)
        .map(x => x.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
};

// All 32 Medicine Fields matching the complete clinical master standard
const MEDICINE_COLUMNS = [
    {
        key: 'Product ID',
        label: 'Product ID',
        width: '130px',
        render: (i) => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #c7d2fe' }}>{i.product_id || i.code || '-'}</span>
    },
    {
        key: 'Product Name',
        label: 'Product Name',
        width: '210px',
        render: (i) => <span style={{ fontWeight: 700, color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.name}>{i.name || '-'}</span>
    },
    {
        key: 'Marketer',
        label: 'Marketer',
        width: '180px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.marketing_company || i.marketer}>{i.marketing_company || i.marketer || '-'}</div>
    },
    {
        key: 'Composition',
        label: 'Composition',
        width: '210px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.composition || i.key_ingredients}>{i.composition || i.key_ingredients || '-'}</div>
    },
    {
        key: 'medicine_type',
        label: 'medicine_type',
        width: '110px',
        render: (i) => <span style={{ textTransform: 'capitalize', fontSize: '11px', background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{i.medicine_type || i.type || 'drugs'}</span>
    },
    {
        key: 'Introduction',
        label: 'Introduction',
        width: '240px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.introduction || i.information}>{i.introduction || i.information || '-'}</div>
    },
    {
        key: 'Benefits',
        label: 'Benefits',
        width: '220px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.benefits || i.key_benefits}>{i.benefits || i.key_benefits || '-'}</div>
    },
    {
        key: 'how_to_use',
        label: 'how_to_use',
        width: '220px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.how_to_use || i.directions_for_use}>{i.how_to_use || i.directions_for_use || '-'}</div>
    },
    {
        key: 'safety_advise',
        label: 'safety_advise',
        width: '240px',
        render: (i) => {
            const val = i.safety_advise || i.safety_information;
            if (!val) return '-';
            const clean = String(val).replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
            return <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#b45309' }} title={clean}>{clean}</div>;
        }
    },
    {
        key: 'if_miss',
        label: 'if_miss',
        width: '200px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.if_miss}>{i.if_miss || '-'}</div>
    },
    {
        key: 'Packaging Detail',
        label: 'Packaging Detail',
        width: '160px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.packaging_detail || i.packaging}>{i.packaging_detail || i.packaging || '-'}</div>
    },
    {
        key: 'Package',
        label: 'Package',
        width: '110px',
        render: (i) => i.package || i.package_type || '-'
    },
    {
        key: 'Qty',
        label: 'Qty',
        width: '80px',
        render: (i) => i.qty != null ? <span style={{ fontWeight: 600, color: '#334155' }}>{i.qty}</span> : '-'
    },
    {
        key: 'Product Form',
        label: 'Product Form',
        width: '120px',
        render: (i) => i.product_form ? <span style={{ fontSize: '11px', fontWeight: 600, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px' }}>{i.product_form}</span> : '-'
    },
    {
        key: 'MRP',
        label: 'MRP',
        width: '110px',
        render: (i) => i.mrp != null ? <span style={{ fontWeight: 800, color: '#059669' }}>₹{i.mrp}</span> : '-'
    },
    {
        key: 'prescription_required',
        label: 'prescription_required',
        width: '150px',
        render: (i) => i.prescription_required ? (
            <span style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Rx Required</span>
        ) : (
            <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>OTC</span>
        )
    },
    {
        key: 'Fact_Box',
        label: 'Fact_Box',
        width: '240px',
        render: (i) => {
            const facts = parseFactBox(i.fact_box);
            if (!facts.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            const fullText = facts.map(f => `${f.label}: ${f.value}`).join('\n');
            return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '230px' }} title={fullText}>
                    {facts.slice(0, 2).map((f, idx) => (
                        <span key={idx} style={{ fontSize: '10px', background: '#f8fafc', color: '#334155', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                            <span style={{ color: '#64748b' }}>{f.label}:</span> {f.value}
                        </span>
                    ))}
                    {facts.length > 2 && (
                        <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            +{facts.length - 2} more
                        </span>
                    )}
                </div>
            );
        }
    },
    {
        key: 'primary_use',
        label: 'primary_use',
        width: '180px',
        render: (i) => {
            const uses = parsePrimaryUse(i.primary_use);
            if (!uses.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '170px' }} title={uses.join(', ')}>
                    {uses.slice(0, 2).map((u, idx) => (
                        <span key={idx} style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>
                            {u}
                        </span>
                    ))}
                    {uses.length > 2 && (
                        <span style={{ fontSize: '10px', background: '#bae6fd', color: '#0369a1', padding: '2px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            +{uses.length - 2}
                        </span>
                    )}
                </div>
            );
        }
    },
    {
        key: 'storage',
        label: 'storage',
        width: '160px',
        render: (i) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.storage}>{i.storage || '-'}</div>
    },
    {
        key: 'side_effect',
        label: 'side_effect',
        width: '230px',
        render: (i) => {
            const list = parseSideEffects(i.side_effects || i.side_effect);
            if (!list.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '220px' }} title={list.join(', ')}>
                    {list.slice(0, 3).map((effect, idx) => (
                        <span key={idx} style={{ fontSize: '10px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {effect}
                        </span>
                    ))}
                    {list.length > 3 && (
                        <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '2px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            +{list.length - 3}
                        </span>
                    )}
                </div>
            );
        }
    },
    {
        key: 'alcoholInteraction',
        label: 'alcoholInteraction',
        width: '230px',
        render: (i) => {
            const fb = parseSafetyInteractions(i.safety_advise || i.safety_information).alcohol_interaction;
            const val = (i.alcohol_interaction && i.alcohol_interaction.length > 25) ? i.alcohol_interaction : (fb || i.alcohol_interaction);
            return renderSafetyCell(val);
        }
    },
    {
        key: 'pregnancyInteraction',
        label: 'pregnancyInteraction',
        width: '230px',
        render: (i) => {
            const fb = parseSafetyInteractions(i.safety_advise || i.safety_information).pregnancy_interaction;
            const val = (i.pregnancy_interaction && i.pregnancy_interaction.length > 25) ? i.pregnancy_interaction : (fb || i.pregnancy_interaction);
            return renderSafetyCell(val);
        }
    },
    {
        key: 'lactationInteraction',
        label: 'lactationInteraction',
        width: '230px',
        render: (i) => {
            const fb = parseSafetyInteractions(i.safety_advise || i.safety_information).lactation_interaction;
            const val = (i.lactation_interaction && i.lactation_interaction.length > 25) ? i.lactation_interaction : (fb || i.lactation_interaction);
            return renderSafetyCell(val);
        }
    },
    {
        key: 'drivingInteraction',
        label: 'drivingInteraction',
        width: '230px',
        render: (i) => {
            const fb = parseSafetyInteractions(i.safety_advise || i.safety_information).driving_interaction;
            const val = (i.driving_interaction && i.driving_interaction.length > 25) ? i.driving_interaction : (fb || i.driving_interaction);
            return renderSafetyCell(val);
        }
    },
    {
        key: 'kidneyInteraction',
        label: 'kidneyInteraction',
        width: '230px',
        render: (i) => {
            const fb = parseSafetyInteractions(i.safety_advise || i.safety_information).kidney_interaction;
            const val = (i.kidney_interaction && i.kidney_interaction.length > 25) ? i.kidney_interaction : (fb || i.kidney_interaction);
            return renderSafetyCell(val);
        }
    },
    {
        key: 'liverInteraction',
        label: 'liverInteraction',
        width: '230px',
        render: (i) => {
            const fb = parseSafetyInteractions(i.safety_advise || i.safety_information).liver_interaction;
            const val = (i.liver_interaction && i.liver_interaction.length > 25) ? i.liver_interaction : (fb || i.liver_interaction);
            return renderSafetyCell(val);
        }
    },
    {
        key: 'country_of_origin',
        label: 'country_of_origin',
        width: '130px',
        render: (i) => i.country_of_origin || '-'
    },
    {
        key: 'Q_A',
        label: 'Q_A (FAQs)',
        width: '280px',
        render: (i) => {
            const qaList = parseQA(i.q_a);
            if (!qaList.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            const first = qaList[0];
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '270px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            background: '#eef2ff',
                            color: '#4f46e5',
                            border: '1px solid #c7d2fe',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}>
                            <HelpCircle size={10} />
                            {qaList.length} Q&A{qaList.length > 1 ? 's' : ''}
                        </span>
                        {qaList.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setViewingItem(i); }}
                                style={{ fontSize: '10px', background: 'transparent', border: 'none', color: '#6366f1', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
                            >
                                +{qaList.length - 1} more
                            </button>
                        )}
                    </div>
                    <div
                        title={`Q: ${first.question}\nA: ${first.answer}`}
                        style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span style={{ color: '#6366f1', fontWeight: 800, marginRight: '4px' }}>Q:</span>{first.question}
                    </div>
                    <div
                        title={`Q: ${first.question}\nA: ${first.answer}`}
                        style={{
                            fontSize: '11px',
                            color: '#475569',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span style={{ color: '#059669', fontWeight: 700, marginRight: '4px' }}>A:</span>{first.answer}
                    </div>
                </div>
            );
        }
    },
    {
        key: 'How it works',
        label: 'How it works',
        width: '240px',
        render: (i) => {
            const points = parseHowItWorks(i.how_it_works);
            if (!points.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '230px' }} title={points.join('\n• ')}>
                    {points.slice(0, 2).map((pt, idx) => (
                        <div key={idx} style={{ fontSize: '11px', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#6366f1', fontSize: '10px' }}>•</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt}</span>
                        </div>
                    ))}
                    {points.length > 2 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setViewingItem(i); }}
                            style={{ fontSize: '10px', background: 'transparent', border: 'none', color: '#6366f1', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, textAlign: 'left', padding: 0 }}
                        >
                            +{points.length - 2} more points
                        </button>
                    )}
                </div>
            );
        }
    },
    {
        key: 'drug-drug Interaction',
        label: 'drug-drug Interaction',
        width: '270px',
        render: (i) => {
            const list = parseDrugInteractions(i.drug_interactions);
            if (!list.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            const first = list[0];
            const sevStyle = getSeverityBadgeStyle(first.severity);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 800, 
                            background: '#fee2e2', 
                            color: '#dc2626', 
                            border: '1px solid #fca5a5', 
                            padding: '1px 7px', 
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}>
                            <AlertCircle size={10} />
                            {list.length} Interaction{list.length > 1 ? 's' : ''}
                        </span>
                        {first.severity && (
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: sevStyle.bg, color: sevStyle.color, border: `1px solid ${sevStyle.border}` }}>
                                {first.severity}
                            </span>
                        )}
                        {list.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setViewingItem(i); }}
                                style={{ fontSize: '10px', background: 'transparent', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
                            >
                                +{list.length - 1} more
                            </button>
                        )}
                    </div>
                    <div 
                        title={`Interaction: ${first.drugName} (${first.severity || 'Notice'})\n${first.details}`}
                        style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: '#0f172a', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                        }}
                    >
                        {first.drugName}
                    </div>
                    {first.details && (
                        <div 
                            title={`Interaction: ${first.drugName} (${first.severity || 'Notice'})\n${first.details}`}
                            style={{ 
                                fontSize: '11px', 
                                color: '#64748b', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap' 
                            }}
                        >
                            {first.details}
                        </div>
                    )}
                </div>
            );
        }
    },
    {
        key: 'Marketer details',
        label: 'Marketer details',
        width: '220px',
        render: (i) => {
            const detail = i.marketer_details;
            if (detail) return <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }} title={detail}>{detail}</div>;
            return <span style={{ color: '#94a3b8' }}>-</span>;
        }
    },
    {
        key: 'Image_Urls',
        label: 'Image_Urls',
        width: '280px',
        render: (i) => {
            const urls = extractImageUrls(i);
            if (!urls.length) return <span style={{ color: '#94a3b8' }}>-</span>;
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '240px' }}>
                    {/* Visual Thumbnails */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {urls.slice(0, 4).map((url, idx) => (
                            <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title={`Open Image ${idx + 1}: ${url}`}
                                style={{ display: 'inline-block', borderRadius: '6px', border: '1.5px solid #cbd5e1', padding: '2px', background: '#fff', textDecoration: 'none' }}
                            >
                                <img
                                    src={url}
                                    alt={`Img ${idx + 1}`}
                                    referrerPolicy="no-referrer"
                                    style={{ width: '32px', height: '32px', objectFit: 'contain', display: 'block', borderRadius: '3px' }}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                    }}
                                />
                            </a>
                        ))}
                        <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 700, background: '#e0e7ff', padding: '2px 8px', borderRadius: '10px' }}>
                            {urls.length} img{urls.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Direct Clickable Links */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {urls.map((url, idx) => (
                            <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title={url}
                                style={{
                                    fontSize: '11px',
                                    color: '#2563eb',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontWeight: 600,
                                    maxWidth: '120px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <span>Image {idx + 1}</span>
                                <ExternalLink size={10} />
                            </a>
                        ))}
                    </div>
                </div>
            );
        }
    }
];

const ClinicalMasterManagement = () => {
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Add single item
    const [isAdding, setIsAdding] = useState(false);
    const [formFieldSearch, setFormFieldSearch] = useState('');
    const [newItem, setNewItem] = useState({
        name: '',
        product_id: '',
        category: 'medicine',
        marketing_company: '',
        marketer: '',
        type: 'drugs',
        medicine_type: 'drugs',
        packaging: '',
        packaging_detail: '',
        package: 'Strip',
        package_type: 'Strip',
        qty: '',
        product_form: 'Tablet',
        mrp: '',
        prescription_required: true,
        product_highlights: '',
        information: '',
        introduction: '',
        key_ingredients: '',
        composition: '',
        key_benefits: '',
        benefits: '',
        directions_for_use: '',
        how_to_use: '',
        safety_information: '',
        safety_advise: '',
        if_miss: '',
        fact_box: '',
        primary_use: '',
        storage: '',
        side_effect: '',
        side_effects: '',
        alcoholInteraction: '',
        alcohol_interaction: '',
        pregnancyInteraction: '',
        pregnancy_interaction: '',
        lactationInteraction: '',
        lactation_interaction: '',
        drivingInteraction: '',
        driving_interaction: '',
        kidneyInteraction: '',
        kidney_interaction: '',
        liverInteraction: '',
        liver_interaction: '',
        country_of_origin: 'India',
        q_a: '',
        how_it_works: '',
        drug_interactions: '',
        marketer_details: '',
        image_urls: '',
        notes: ''
    });
    const [saving, setSaving] = useState(false);

    // Multi-item helper input states for Add Medicine form
    const [multiInputs, setMultiInputs] = useState({
        newImageUrl: '',
        newSideEffect: '',
        newPrimaryUse: '',
        newIngredient: '',
        newDrug: { drugName: '', severity: 'Severe', details: '' },
        newQA: { question: '', answer: '' },
        newFact: { label: '', value: '' },
        rawMode: {
            images: false,
            fact_box: false,
            safety: false,
            drugs: false,
            qa: false
        }
    });

    // Add / Remove Image URL
    const handleAddImage = () => {
        const url = multiInputs.newImageUrl.trim();
        if (!url) return;
        const current = extractImageUrls(newItem.image_urls);
        if (!current.includes(url)) {
            setNewItem(prev => ({
                ...prev,
                image_urls: [...current, url].join(' | ')
            }));
        }
        setMultiInputs(prev => ({ ...prev, newImageUrl: '' }));
    };

    const handleRemoveImage = (indexToRemove) => {
        const current = extractImageUrls(newItem.image_urls);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        setNewItem(prev => ({ ...prev, image_urls: filtered.join(' | ') }));
    };

    // Add / Remove Drug Interaction
    const handleAddDrugInteraction = () => {
        const { drugName, severity, details } = multiInputs.newDrug;
        if (!drugName.trim()) return;
        const current = parseDrugInteractions(newItem.drug_interactions);
        const updated = [...current, { drugName: drugName.trim(), severity, details: details.trim() }];
        const serialized = updated.map(d => `-${d.drugName}: ${d.severity} <p> ${d.details}`).join(' | ');
        setNewItem(prev => ({ ...prev, drug_interactions: serialized }));
        setMultiInputs(prev => ({ ...prev, newDrug: { drugName: '', severity: 'Severe', details: '' } }));
    };

    const handleRemoveDrugInteraction = (indexToRemove) => {
        const current = parseDrugInteractions(newItem.drug_interactions);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        const serialized = filtered.map(d => `-${d.drugName}: ${d.severity} <p> ${d.details}`).join(' | ');
        setNewItem(prev => ({ ...prev, drug_interactions: serialized }));
    };

    // Add / Remove Q&A
    const handleAddQA = () => {
        const { question, answer } = multiInputs.newQA;
        if (!question.trim()) return;
        const current = parseQA(newItem.q_a);
        const updated = [...current, { question: question.trim(), answer: answer.trim() }];
        const serialized = updated.map(item => `Q. ${item.question} A. ${item.answer}`).join(' | ');
        setNewItem(prev => ({ ...prev, q_a: serialized }));
        setMultiInputs(prev => ({ ...prev, newQA: { question: '', answer: '' } }));
    };

    const handleRemoveQA = (indexToRemove) => {
        const current = parseQA(newItem.q_a);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        const serialized = filtered.map(item => `Q. ${item.question} A. ${item.answer}`).join(' | ');
        setNewItem(prev => ({ ...prev, q_a: serialized }));
    };

    // Add / Remove Fact
    const handleAddFact = (labelParam, valueParam) => {
        const label = (labelParam || multiInputs.newFact.label).trim();
        const value = (valueParam || multiInputs.newFact.value).trim();
        if (!label || !value) return;
        const current = parseFactBox(newItem.fact_box);
        const existingIdx = current.findIndex(f => f.label.toLowerCase() === label.toLowerCase());
        let updated;
        if (existingIdx !== -1) {
            updated = [...current];
            updated[existingIdx] = { label, value };
        } else {
            updated = [...current, { label, value }];
        }
        const serialized = updated.map(f => `${f.label} :: ${f.value}`).join(' | ');
        setNewItem(prev => ({ ...prev, fact_box: serialized }));
        setMultiInputs(prev => ({ ...prev, newFact: { label: '', value: '' } }));
    };

    const handleRemoveFact = (indexToRemove) => {
        const current = parseFactBox(newItem.fact_box);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        const serialized = filtered.map(f => `${f.label} :: ${f.value}`).join(' | ');
        setNewItem(prev => ({ ...prev, fact_box: serialized }));
    };

    // Add / Remove Side Effects (Chips)
    const handleAddSideEffect = () => {
        const item = multiInputs.newSideEffect.trim();
        if (!item) return;
        const current = (newItem.side_effects || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!current.includes(item)) {
            setNewItem(prev => ({ ...prev, side_effects: [...current, item].join(', ') }));
        }
        setMultiInputs(prev => ({ ...prev, newSideEffect: '' }));
    };

    const handleRemoveSideEffect = (indexToRemove) => {
        const current = (newItem.side_effects || '').split(',').map(s => s.trim()).filter(Boolean);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        setNewItem(prev => ({ ...prev, side_effects: filtered.join(', ') }));
    };

    // Add / Remove Primary Use / Indications (Chips)
    const handleAddPrimaryUse = () => {
        const item = multiInputs.newPrimaryUse.trim();
        if (!item) return;
        const current = (newItem.primary_use || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!current.includes(item)) {
            setNewItem(prev => ({ ...prev, primary_use: [...current, item].join(', ') }));
        }
        setMultiInputs(prev => ({ ...prev, newPrimaryUse: '' }));
    };

    const handleRemovePrimaryUse = (indexToRemove) => {
        const current = (newItem.primary_use || '').split(',').map(s => s.trim()).filter(Boolean);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        setNewItem(prev => ({ ...prev, primary_use: filtered.join(', ') }));
    };

    // Add / Remove Composition / Active Molecules (Chips)
    const handleAddIngredient = () => {
        const item = multiInputs.newIngredient.trim();
        if (!item) return;
        const current = (newItem.composition || '').split('+').map(s => s.trim()).filter(Boolean);
        if (!current.includes(item)) {
            const updated = [...current, item].join(' + ');
            setNewItem(prev => ({ ...prev, composition: updated, key_ingredients: updated }));
        }
        setMultiInputs(prev => ({ ...prev, newIngredient: '' }));
    };

    const handleRemoveIngredient = (indexToRemove) => {
        const current = (newItem.composition || '').split('+').map(s => s.trim()).filter(Boolean);
        const filtered = current.filter((_, idx) => idx !== indexToRemove);
        const updated = filtered.join(' + ');
        setNewItem(prev => ({ ...prev, composition: updated, key_ingredients: updated }));
    };

    // Safety Advisories Structured Updater
    const handleUpdateSafetyCategory = (catKey, status, desc) => {
        const safetyMap = parseSafetyInteractions(newItem.safety_advise);
        const updatedDesc = (desc != null) ? desc : (safetyMap[`${catKey}_interaction`] || '').replace(/^[A-Z\s]+<p>/i, '').trim();
        const updatedStatus = status || 'CONSULT YOUR DOCTOR';
        
        const keyLabels = {
            alcohol: 'Alcohol',
            pregnancy: 'Pregnancy',
            lactation: 'Breast feeding',
            driving: 'Driving',
            kidney: 'Kidney',
            liver: 'Liver'
        };
        
        // Update the interactions object
        const categories = ['alcohol', 'pregnancy', 'lactation', 'driving', 'kidney', 'liver'];
        const parts = [];
        
        categories.forEach(c => {
            const label = keyLabels[c];
            if (c === catKey) {
                parts.push(`- ${label} : ${updatedStatus} <p> ${updatedDesc}`);
            } else {
                const existingVal = safetyMap[`${c}_interaction`] || safetyMap[`${c}Interaction`];
                if (existingVal) {
                    parts.push(`- ${label} : ${existingVal}`);
                }
            }
        });
        
        setNewItem(prev => ({ ...prev, safety_advise: parts.join(' | ') }));
    };

    // Excel / CSV Bulk Import
    const [isImporting, setIsImporting] = useState(false);
    const [importingFile, setImportingFile] = useState(null);
    const [parsedRows, setParsedRows] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importParseInfo, setImportParseInfo] = useState(null); // { detectedCols, warnings, sample }
    const [availableSheets, setAvailableSheets] = useState([]);
    const [activeSheetName, setActiveSheetName] = useState('');
    const workbookRef = useRef(null);
    const fileInputRef = useRef(null);

    // Detail view modal
    const [viewingItem, setViewingItem] = useState(null);

    const [status, setStatus] = useState({ type: '', message: '' });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMasterData({ category: selectedCategory, limit: 500 });
            setData(res.data?.data || []);
        } catch (err) {
            console.error('Failed to load master data', err);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!newItem.name) return;
        setSaving(true);
        try {
            const payload = {
                category: selectedCategory,
                name: newItem.name.trim(),
                product_id: newItem.product_id || undefined,
                code: newItem.product_id || undefined,
                marketer: newItem.marketer || newItem.marketing_company || undefined,
                marketing_company: newItem.marketing_company || newItem.marketer || undefined,
                type: newItem.medicine_type || newItem.type || undefined,
                medicine_type: newItem.medicine_type || newItem.type || undefined,
                packaging: newItem.packaging_detail || newItem.packaging || undefined,
                packaging_detail: newItem.packaging_detail || newItem.packaging || undefined,
                package: newItem.package || newItem.package_type || undefined,
                package_type: newItem.package || newItem.package_type || undefined,
                qty: newItem.qty || undefined,
                product_form: newItem.product_form || undefined,
                mrp: newItem.mrp ? parseFloat(newItem.mrp) : undefined,
                prescription_required: newItem.prescription_required !== false,
                product_highlights: newItem.product_highlights || undefined,
                information: newItem.information || newItem.introduction || undefined,
                introduction: newItem.introduction || newItem.information || undefined,
                key_ingredients: newItem.key_ingredients || newItem.composition || undefined,
                composition: newItem.composition || newItem.key_ingredients || undefined,
                key_benefits: newItem.key_benefits || newItem.benefits || undefined,
                benefits: newItem.benefits || newItem.key_benefits || undefined,
                directions_for_use: newItem.directions_for_use || newItem.how_to_use || undefined,
                how_to_use: newItem.how_to_use || newItem.directions_for_use || undefined,
                safety_information: newItem.safety_information || newItem.safety_advise || undefined,
                safety_advise: newItem.safety_advise || newItem.safety_information || undefined,
                if_miss: newItem.if_miss || undefined,
                fact_box: newItem.fact_box || undefined,
                primary_use: newItem.primary_use || undefined,
                storage: newItem.storage || undefined,
                side_effect: newItem.side_effect || newItem.side_effects || undefined,
                side_effects: newItem.side_effect || newItem.side_effects || undefined,
                alcoholInteraction: newItem.alcoholInteraction || newItem.alcohol_interaction || undefined,
                alcohol_interaction: newItem.alcoholInteraction || newItem.alcohol_interaction || undefined,
                pregnancyInteraction: newItem.pregnancyInteraction || newItem.pregnancy_interaction || undefined,
                pregnancy_interaction: newItem.pregnancyInteraction || newItem.pregnancy_interaction || undefined,
                lactationInteraction: newItem.lactationInteraction || newItem.lactation_interaction || undefined,
                lactation_interaction: newItem.lactationInteraction || newItem.lactation_interaction || undefined,
                drivingInteraction: newItem.drivingInteraction || newItem.driving_interaction || undefined,
                driving_interaction: newItem.drivingInteraction || newItem.driving_interaction || undefined,
                kidneyInteraction: newItem.kidneyInteraction || newItem.kidney_interaction || undefined,
                kidney_interaction: newItem.kidneyInteraction || newItem.kidney_interaction || undefined,
                liverInteraction: newItem.liverInteraction || newItem.liver_interaction || undefined,
                liver_interaction: newItem.liverInteraction || newItem.liver_interaction || undefined,
                country_of_origin: newItem.country_of_origin || undefined,
                q_a: newItem.q_a || undefined,
                how_it_works: newItem.how_it_works || undefined,
                drug_interactions: newItem.drug_interactions || undefined,
                marketer_details: newItem.marketer_details || undefined,
                notes: newItem.notes || undefined,
                image_urls: extractImageUrls(newItem.image_urls)
            };

            await upsertMasterData(payload);
            setStatus({ type: 'success', message: 'Item saved successfully' });
            setNewItem({
                name: '', product_id: '', category: 'medicine', marketing_company: '', marketer: '', type: 'drugs',
                medicine_type: 'drugs', packaging: '', packaging_detail: '', package: 'Strip', package_type: 'Strip',
                qty: '', product_form: 'Tablet', mrp: '', prescription_required: true, product_highlights: '',
                information: '', introduction: '', key_ingredients: '', composition: '', key_benefits: '', benefits: '',
                directions_for_use: '', how_to_use: '', safety_information: '', safety_advise: '', if_miss: '',
                fact_box: '', primary_use: '', storage: '', side_effect: '', side_effects: '',
                alcoholInteraction: '', alcohol_interaction: '', pregnancyInteraction: '', pregnancy_interaction: '',
                lactationInteraction: '', lactation_interaction: '', drivingInteraction: '', driving_interaction: '',
                kidneyInteraction: '', kidney_interaction: '', liverInteraction: '', liver_interaction: '',
                country_of_origin: 'India', q_a: '', how_it_works: '', drug_interactions: '', marketer_details: '', image_urls: '', notes: ''
            });
            setIsAdding(false);
            loadData();
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to save item' });
        } finally {
            setSaving(false);
            setTimeout(() => setStatus({ type: '', message: '' }), 3500);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this master data item?')) return;
        try {
            await deleteMasterData(id);
            setData(data.filter(item => (item.id || item._id) !== id));
            setStatus({ type: 'success', message: 'Item deleted' });
        } catch (err) {
            alert('Failed to delete item');
        } finally {
            setTimeout(() => setStatus({ type: '', message: '' }), 2000);
        }
    };

    const handleClearCategory = async () => {
        const count = data.length;
        if (count === 0) return;
        const confirmed = window.confirm(
            `Are you sure you want to remove all ${count} ${activeCat.name.toLowerCase()} from the database? This action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            await clearCategoryMasterData(selectedCategory);
            setData([]);
            setStatus({ type: 'success', message: `Successfully cleared all ${activeCat.name.toLowerCase()} from database!` });
        } catch (err) {
            console.error('Failed to clear category:', err);
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to clear category' });
        } finally {
            setTimeout(() => setStatus({ type: '', message: '' }), 3500);
        }
    };

    // Export all records with the exact 32 column names
    const handleExportExcel = () => {
        if (!data.length) return;
        const exportRows = data.map(item => ({
            'Product ID': item.product_id || item.code || '',
            'Product Name': item.name || '',
            'Marketer': item.marketing_company || item.marketer || '',
            'Composition': item.composition || item.key_ingredients || '',
            'medicine_type': item.medicine_type || item.type || '',
            'Introduction': item.introduction || item.information || '',
            'Benefits': item.benefits || item.key_benefits || '',
            'how_to_use': item.how_to_use || item.directions_for_use || '',
            'safety_advise': item.safety_advise || item.safety_information || '',
            'if_miss': item.if_miss || '',
            'Packaging Detail': item.packaging_detail || item.packaging || '',
            'Package': item.package || item.package_type || '',
            'Qty': item.qty != null ? item.qty : '',
            'Product Form': item.product_form || '',
            'MRP': item.mrp != null ? item.mrp : '',
            'prescription_required': item.prescription_required ? 'Prescription Required' : 'Not Required',
            'Fact_Box': item.fact_box || '',
            'primary_use': item.primary_use || '',
            'storage': item.storage || '',
            'side_effect': item.side_effects || '',
            'alcoholInteraction': item.alcohol_interaction || '',
            'pregnancyInteraction': item.pregnancy_interaction || '',
            'lactationInteraction': item.lactation_interaction || '',
            'drivingInteraction': item.driving_interaction || '',
            'kidneyInteraction': item.kidney_interaction || '',
            'liverInteraction': item.liver_interaction || '',
            'country_of_origin': item.country_of_origin || '',
            'Q_A': item.q_a || '',
            'How it works': item.how_it_works || '',
            'drug-drug Interaction': item.drug_interactions || '',
            'Marketer details': item.marketer_details || '',
            'Image_Urls': extractImageUrls(item).join(' | ')
        }));

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Medicines');
        XLSX.writeFile(wb, `Clinical_Master_32_Columns_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Download template with exact 32 column headers
    const handleDownloadTemplate = () => {
        const templateRows = [{
            'Product ID': 'DRS003256',
            'Product Name': 'Acenac Tablet',
            'Marketer': 'Medley Pharmaceuticals',
            'Composition': 'Aceclofenac (100mg)',
            'medicine_type': 'drugs',
            'Introduction': 'Acenac Tablet is a pain-relieving medicine. It alleviates pain and inflammation in conditions such as rheumatoid arthritis, ankylosing spondylitis, osteoarthritis, low back pain, dental pain, gynecological pain, and painful & inflammatory conditions of the ear, nose, and throat.',
            'Benefits': 'Pain relief and reduction of inflammation in arthritis and acute pain.',
            'how_to_use': 'Acenac Tablet should be taken at the dose and duration advised by your doctor. It should be taken with food or milk to prevent stomach upset.',
            'safety_advise': '- Alcohol : CONSULT YOUR DOCTOR <p> It is not known whether it is safe to consume alcohol with Acenac Tablet. Please consult your doctor. | - Pregnancy : CONSULT YOUR DOCTOR <p> Acenac Tablet is not recommended during pregnancy as there is positive evidence of fetal risk based on animal studies. However, it may still be prescribed by a doctor in situations where the benefits outweigh the risks. | - Breast feeding : CAUTION <p> Acenac Tablet should be used with caution during breastfeeding. Breastfeeding should be held until the treatment of the mother is completed and the drug is eliminated from the body. | - Driving : UNSAFE <p> Acenac Tablet may decrease alertness, affect your vision, or make you feel sleepy and dizzy. Do not drive if these symptoms occur. | - Kidney : CAUTION <p> Acenac Tablet should be used with caution in patients with kidney disease. Dose adjustment may be needed.Use of Acenac Tablet is not recommended in patients with severe kidney disease. | - Liver : CAUTION <p> Acenac Tablet should be used with caution in patients with liver disease. Dose adjustment may be needed.Use of Acenac Tablet is not recommended in patients with severe liver disease. Regular monitoring of liver function tests is advisable while the patient is taking this medicine.',
            'if_miss': 'If you miss a dose, take it as soon as you remember. If it is near the time of the next dose, skip the missed dose and resume your regular schedule.',
            'Packaging Detail': 'strip of 10 tablets',
            'Package': 'Strip',
            'Qty': '10',
            'Product Form': 'Tablet',
            'MRP': 55.78,
            'prescription_required': 'Prescription Required',
            'Fact_Box': "Chemical Class :: Dichlorobenzenes | Habit Forming :: No | Therapeutic Class :: PAIN ANALGESICS | Action Class :: NSAID's- Non-Selective COX 1&2 Inhibitors (acetic acid)",
            'primary_use': 'Pain relief',
            'storage': 'Store below 30°C',
            'side_effect': 'Vomiting, stomach pain, nausea, and indigestion',
            'alcoholInteraction': 'CONSULT YOUR DOCTOR <p> It is not known whether it is safe to consume alcohol with Acenac Tablet. Please consult your doctor.',
            'pregnancyInteraction': 'CONSULT YOUR DOCTOR <p> Acenac Tablet is not recommended during pregnancy as there is positive evidence of fetal risk based on animal studies. However, it may still be prescribed by a doctor in situations where the benefits outweigh the risks.',
            'lactationInteraction': 'CAUTION <p> Acenac Tablet should be used with caution during breastfeeding. Breastfeeding should be held until the treatment of the mother is completed and the drug is eliminated from the body.',
            'drivingInteraction': 'UNSAFE <p> Acenac Tablet may decrease alertness, affect your vision, or make you feel sleepy and dizzy. Do not drive if these symptoms occur.',
            'kidneyInteraction': 'CAUTION <p> Acenac Tablet should be used with caution in patients with kidney disease. Dose adjustment may be needed.Use of Acenac Tablet is not recommended in patients with severe kidney disease.',
            'liverInteraction': 'CAUTION <p> Acenac Tablet should be used with caution in patients with liver disease. Dose adjustment may be needed.Use of Acenac Tablet is not recommended in patients with severe liver disease. Regular monitoring of liver function tests is advisable while the patient is taking this medicine.',
            'country_of_origin': 'India',
            'Q_A': 'Q: Can I take Acenac Tablet for a toothache? A: Yes, Acenac Tablet is commonly prescribed for dental pain relief.',
            'How it works': 'Acenac Tablet works by blocking the action of cyclooxygenase (COX) enzymes which produce prostaglandins that cause pain and swelling.',
            'drug-drug Interaction': 'Avoid taking with other NSAIDs (ibuprofen, aspirin) or blood thinners (warfarin).',
            'Marketer details': 'Medley Pharmaceuticals Ltd, Andheri East, Mumbai',
            'Image_Urls': 'https://medicinedata.in/drg/DRS003256_1.jpg | https://medicinedata.in/drg/DRS003256_2.jpg | https://medicinedata.in/drg/DRS003256_3.jpg'
        }];
        const ws = XLSX.utils.json_to_sheet(templateRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'Medicine_32_Columns_Template.xlsx');
    };

    // ── Smart Excel / CSV Import Handler ─────────────────────────────────────
    // Auto-detects column name aliases, normalizes 32-column pharmaceutical format,
    // splits safety/marketer/image fields automatically.

    const SAFETY_KEYWORDS = ['CONSULT YOUR DOCTOR', 'UNSAFE', 'CAUTION', 'SAFE', 'SAFE IF PRESCRIBED'];

    const smartExtractImageUrls = (raw) => {
        if (!raw) return [];
        const str = String(raw).trim();
        const urls = [];
        // Markdown links: [text](url)
        const mdRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
        let m;
        while ((m = mdRe.exec(str)) !== null) urls.push(m[2]);
        if (urls.length) return [...new Set(urls)];
        // Plain URLs separated by pipe/comma/space
        const plain = str.match(/https?:\/\/[^\s\"'<>|,\]]+/g);
        if (plain) return [...new Set(plain)];
        return [];
    };

    const smartSeparateMarketer = (raw) => {
        if (!raw) return { marketer: null, marketer_details: null };
        const s = String(raw).trim();
        const hasAddress = /plot no|street no|m\.i\.d\.c|road|floor|building|district|estate|ground floor|pvt ltd \||ltd \||mumbai|gujarat|bangalore|delhi|hyderabad|vadodara/i.test(s);
        if (!hasAddress) return { marketer: s, marketer_details: null };
        // e.g. "Company Name | Plot No. 5, Area, City - 400001, STATE"
        const parts = s.split('|').map(p => p.trim());
        if (parts.length >= 2) return { marketer: parts[0], marketer_details: s };
        return { marketer: null, marketer_details: s };
    };

    const isShifted17Col = (row) => {
        if (!row || typeof row !== 'object') return false;
        const img = String(row['Image_Urls'] || row['image_urls'] || '').trim();
        if (img.toLowerCase().startsWith('http://') || img.toLowerCase().startsWith('https://')) return false;

        const mrp = String(row['MRP'] || row['mrp'] || '').trim();
        const dir = row['Directions for Use'] || row['directions_for_use'] || row['Directions'];

        if (mrp.toLowerCase().includes('miss') || mrp.toLowerCase().includes('schedule')) return true;

        const imgIsStorage = img.toLowerCase().includes('store') || img.toLowerCase().includes('°c') || img.toLowerCase().includes('degree');
        const dirIsPrice = typeof dir === 'number' || (!isNaN(Number(dir)) && Number(dir) > 0 && String(dir).length < 10);
        if (imgIsStorage && dirIsPrice) return true;

        const keyBen = String(row['Key Benefits'] || '').trim().toLowerCase();
        const isForm = ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'ointment', 'gel'].some(f => keyBen.startsWith(f));
        if (isForm && (typeof row['Key Ingredients'] === 'number' || dirIsPrice)) return true;

        return false;
    };

    const smartNormalizeRow = (row) => {
        const str = v => { const s = v !== null && v !== undefined ? String(v).trim() : ''; return s || null; };
        const flt = v => { if (!v) return null; const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
        const bool = v => { if (!v) return true; const s = String(v).toLowerCase(); return !s.includes('otc') && !s.includes('not req') && !s.includes('false') && !s.includes('no'); };

        // Handle shifted 17-column legacy Excel format
        if (isShifted17Col(row)) {
            const name = str(row.name || row['Product Name'] || row.product_name) || 'Unnamed Medicine';
            const productId = str(row['Product ID'] || row.product_id || row.productId || row.code);
            const marketer = str(row['Category']);
            const composition = str(row['Marketing Company']);
            const medType = str(row.type || row.medicine_type) || 'drugs';
            const introduction = str(row['Packaging']);
            const benefits = str(row['Package']);
            const safetyAdvise = str(row['Product Form']);
            const packagingDetail = str(row['product_highlights'] || row['product_h']);
            const packageType = str(row['Information'] || row['Informatic']);
            const qty = str(row['Key Ingredients'] || row['Key Ingred']);
            const productForm = str(row['Key Benefits'] || row['Key Benefi']);
            const mrp = flt(row['Directions for Use'] || row['Directions']);
            const prescReq = bool(row['Safety Information'] || row['Safety Info'], true);
            const factBox = str(row['country_of_origin'] || row['country_o']);
            const primaryUse = str(row['Marketer details'] || row['Marketer d']);
            const storage = str(row['Image_Urls']);
            const rawImg = row['__EMPTY_12'] || row['images'] || row['Images'] || row.image_urls;
            const imageUrls = smartExtractImageUrls(rawImg);
            const parsedSafety = parseSafetyInteractions(safetyAdvise);

            return {
                category: 'medicine',
                name,
                product_id: productId,
                code: productId,
                marketing_company: marketer,
                marketer: marketer,
                medicine_type: medType,
                type: medType,
                packaging: packagingDetail,
                packaging_detail: packagingDetail,
                package: packageType,
                package_type: packageType,
                qty: qty,
                product_form: productForm,
                mrp: mrp,
                product_highlights: packagingDetail,
                information: introduction,
                introduction: introduction,
                key_ingredients: composition,
                composition: composition,
                key_benefits: benefits,
                benefits: benefits,
                directions_for_use: str(row['how_to_use'] || row.how_to_use),
                how_to_use: str(row['how_to_use'] || row.how_to_use),
                safety_information: safetyAdvise,
                safety_advise: safetyAdvise,
                if_miss: str(row.if_miss || row['if_miss']),
                prescription_required: prescReq,
                fact_box: factBox,
                primary_use: primaryUse,
                storage: storage,
                side_effects: str(row['__EMPTY'] || row.side_effects || row.side_effect || row['side_effect'] || benefits),
                alcohol_interaction: str(row['__EMPTY_1'] || parsedSafety.alcohol_interaction),
                pregnancy_interaction: str(row['__EMPTY_2'] || parsedSafety.pregnancy_interaction),
                lactation_interaction: str(row['__EMPTY_3'] || parsedSafety.lactation_interaction),
                driving_interaction: str(row['__EMPTY_4'] || parsedSafety.driving_interaction),
                kidney_interaction: str(row['__EMPTY_5'] || parsedSafety.kidney_interaction),
                liver_interaction: str(row['__EMPTY_6'] || parsedSafety.liver_interaction),
                country_of_origin: str(row['__EMPTY_7'] || row.country_of_origin || 'India'),
                q_a: str(row['__EMPTY_8'] || row.q_a || row.Q_A || row['Q_A'] || row['Q_A (FAQs)'] || row['Q&A']),
                how_it_works: str(row['__EMPTY_9'] || row.how_it_works || row['How it works'] || row['how_it_works']),
                drug_interactions: str(row['__EMPTY_10'] || row.drug_interactions || row['drug-drug Interaction'] || row['Drug-Drug Interaction']),
                marketer_details: str(row['__EMPTY_11'] || row.marketer_details || null),
                image_urls: imageUrls,
                is_active: true
            };
        }

        const g = (...keys) => {
            const rowKeys = Object.keys(row);
            for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
                const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                const found = rowKeys.find(rk => {
                    const rkNorm = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return rkNorm === norm || (norm.length >= 4 && rkNorm.startsWith(norm)) || (rkNorm.length >= 4 && norm.startsWith(rkNorm));
                });
                if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') return row[found];
            }
            return null;
        };

        const rawMarketer = g('Marketer', 'marketer', 'Marketing Company', 'Marketing', 'marketing_company', 'Company', 'Manufacturer', 'Brand');
        const rawDetails = g('Marketer details', 'marketer_details', 'Marketer Details', 'Marketer d', 'Address', 'Company Address');
        const { marketer, marketer_details } = smartSeparateMarketer(rawDetails || rawMarketer);
        const finalMarketer = (!rawDetails && marketer) ? rawMarketer : (str(rawMarketer) || marketer);
        const finalDetails = rawDetails ? str(rawDetails) : marketer_details;

        const rawImages = g('Image_Urls', 'image_urls', 'Images', 'images', 'Image URL', 'Image URLs', 'Photos');
        const imageUrls = smartExtractImageUrls(rawImages);

        const rawSafety = g('safety_advise', 'safety_information', 'Safety Advise', 'Safety Advice', 'Safety Information', 'Safety Info', 'Precautions');
        const safetyInteractions = {
            alcohol: str(g('alcoholInteraction', 'alcohol_interaction', 'Alcohol', 'Alcohol Interaction')),
            pregnancy: str(g('pregnancyInteraction', 'pregnancy_interaction', 'Pregnancy', 'Pregnancy Interaction')),
            lactation: str(g('lactationInteraction', 'lactation_interaction', 'Lactation', 'Breast feeding', 'Breastfeeding')),
            driving: str(g('drivingInteraction', 'driving_interaction', 'Driving', 'Driving Interaction')),
            kidney: str(g('kidneyInteraction', 'kidney_interaction', 'Kidney', 'Kidney Interaction')),
            liver: str(g('liverInteraction', 'liver_interaction', 'Liver', 'Liver Interaction'))
        };
        // If safety_advise was a structured string, parse inline
        if (rawSafety && typeof rawSafety === 'string') {
            const parsed = parseSafetyInteractions(rawSafety);
            if (!safetyInteractions.alcohol && parsed.alcohol_interaction) safetyInteractions.alcohol = parsed.alcohol_interaction;
            if (!safetyInteractions.pregnancy && parsed.pregnancy_interaction) safetyInteractions.pregnancy = parsed.pregnancy_interaction;
            if (!safetyInteractions.lactation && parsed.lactation_interaction) safetyInteractions.lactation = parsed.lactation_interaction;
            if (!safetyInteractions.driving && parsed.driving_interaction) safetyInteractions.driving = parsed.driving_interaction;
            if (!safetyInteractions.kidney && parsed.kidney_interaction) safetyInteractions.kidney = parsed.kidney_interaction;
            if (!safetyInteractions.liver && parsed.liver_interaction) safetyInteractions.liver = parsed.liver_interaction;
        }

        return {
            category: 'medicine',
            name: str(g('Product Name', 'name', 'product_name', 'Medicine Name', 'Item Name', 'Title')) || 'Unnamed Medicine',
            product_id: str(g('Product ID', 'product_id', 'code', 'productId', 'Item Code', 'DRS Code')),
            code: str(g('Product ID', 'product_id', 'code', 'productId')),
            marketing_company: str(finalMarketer),
            marketer: str(finalMarketer),
            medicine_type: str(g('medicine_type', 'type', 'Medicine Type')) || 'drugs',
            type: str(g('medicine_type', 'type')) || 'drugs',
            composition: str(g('Composition', 'composition', 'Key Ingredients', 'Key Ingred', 'key_ingredients', 'Salt', 'Salt Composition', 'Active Ingredients')),
            key_ingredients: str(g('Composition', 'composition', 'Key Ingredients', 'Key Ingred', 'key_ingredients', 'Salt')),
            introduction: str(g('Introduction', 'introduction', 'Information', 'Informatic', 'information', 'Description', 'About')),
            information: str(g('Introduction', 'introduction', 'Information', 'Informatic', 'information')),
            benefits: str(g('Benefits', 'benefits', 'Key Benefits', 'Key Benefi', 'key_benefits', 'Uses', 'Indications')),
            key_benefits: str(g('Benefits', 'benefits', 'Key Benefits', 'Key Benefi', 'key_benefits')),
            how_to_use: str(g('how_to_use', 'directions_for_use', 'Directions for Use', 'Directions', 'How To Use', 'Usage', 'Dosage')),
            directions_for_use: str(g('how_to_use', 'directions_for_use', 'Directions for Use', 'Directions', 'Dosage')),
            safety_advise: str(rawSafety),
            safety_information: str(rawSafety),
            if_miss: str(g('if_miss', 'If Miss', 'Missed Dose')),
            packaging_detail: str(g('Packaging Detail', 'packaging_detail', 'Packaging', 'packaging', 'product_highlights', 'product_h', 'Packing')),
            packaging: str(g('Packaging Detail', 'packaging_detail', 'Packaging', 'packaging')),
            package: str(g('Package', 'package', 'Package Type', 'package_type', 'Container')),
            package_type: str(g('Package', 'package', 'Package Type', 'package_type')),
            qty: str(g('Qty', 'qty', 'Quantity', 'Pack Size')),
            product_form: str(g('Product Form', 'Product Fc', 'product_form', 'Form', 'form', 'Dosage Form')),
            mrp: flt(g('MRP', 'mrp', 'Price', 'price', 'Rate', 'Cost')),
            prescription_required: bool(g('prescription_required', 'Prescription Required', 'prescriptionRequired', 'Rx', 'Prescription')),
            fact_box: str(g('Fact_Box', 'fact_box', 'Fact Box', 'Classification', 'Pharmaceutical Classification')),
            primary_use: str(g('primary_use', 'Primary Use', 'primaryUse', 'Indication', 'Therapeutic Use', 'Main Use')),
            storage: str(g('storage', 'Storage', 'Storage Condition')),
            side_effects: str(g('side_effect', 'side_effects', 'Side Effects', 'Side Effect', 'Adverse Reactions')),
            alcohol_interaction: safetyInteractions.alcohol,
            pregnancy_interaction: safetyInteractions.pregnancy,
            lactation_interaction: safetyInteractions.lactation,
            driving_interaction: safetyInteractions.driving,
            kidney_interaction: safetyInteractions.kidney,
            liver_interaction: safetyInteractions.liver,
            country_of_origin: str(g('country_of_origin', 'country_o', 'Country of Origin', 'countryOfOrigin', '__EMPTY_7')) || 'India',
            q_a: str(g('Q_A', 'q_a', 'QA', 'Q&A', 'Questions & Answers', 'FAQS', 'FAQs', 'Q_A (FAQs)', '__EMPTY_8')),
            how_it_works: str(g('How it works', 'how_it_works', 'How It Works', 'Mechanism of Action', 'Mechanism', '__EMPTY_9')),
            drug_interactions: str(g('drug-drug Interaction', 'drug_interactions', 'Drug-Drug Interaction', 'Drug Interactions', 'Interactions', '__EMPTY_10')),
            marketer_details: finalDetails || str(g('__EMPTY_11')),
            image_urls: (imageUrls && imageUrls.length > 0) ? imageUrls : smartExtractImageUrls(g('__EMPTY_12')),
            is_active: true
        };
    };

    const processSheet = (wb, sheetName) => {
        try {
            const ws = wb.Sheets[sheetName];
            if (!ws) return;
            const rawData = XLSX.utils.sheet_to_json(ws, { defval: null });

            if (!rawData || rawData.length === 0) {
                setStatus({ type: 'error', message: `No data found in sheet "${sheetName}".` });
                setParsedRows([]);
                setImportParseInfo(null);
                return;
            }

            // Check if uploaded file is the 17-column shifted dataset
            const isShifted = rawData.length > 0 && isShifted17Col(rawData[0]);

            // Auto-detect columns from headers of first row
            const headers = Object.keys(rawData[0] || {});
            const firstRow = rawData[0] || {};
            const colMap = isShifted ? {
                'Product ID': true,
                'Product Name': true,
                'Marketer': true,
                'Composition': true,
                'MRP': true,
                'Product Form': true,
                'Fact Box': true,
                'Safety Info': true,
                'Primary Use': true,
                'Storage': true,
                'Marketer Details': !!(firstRow['__EMPTY_11'] || firstRow['marketer_details'] || firstRow['Marketer details'] || firstRow['Marketer d']),
                'Image URLs': !!(firstRow['__EMPTY_12'] || (firstRow['Image_Urls'] && !String(firstRow['Image_Urls']).toLowerCase().startsWith('store'))),
                'Q&A': !!(firstRow['__EMPTY_8'] || firstRow['Q_A'] || firstRow['Q_A (FAQs)'] || firstRow['Q&A']),
                'How it works': !!(firstRow['__EMPTY_9'] || firstRow['How it works']),
                'Drug Interactions': !!(firstRow['__EMPTY_10'] || firstRow['drug-drug Interaction']),
            } : {
                'Product ID': headers.some(h => /product.?id|drs.?code|code/i.test(h)),
                'Product Name': headers.some(h => /product.?name|medicine.?name|^name$/i.test(h)),
                'Marketer': headers.some(h => /marketer|company|manufacturer|brand|^marketing/i.test(h)),
                'Composition': headers.some(h => /composition|ingredient|salt/i.test(h)),
                'MRP': headers.some(h => /^mrp$|^price$|^rate$|^cost$/i.test(h)),
                'Product Form': headers.some(h => /product.?form|product.?fc|^form$|dosage.?form/i.test(h)),
                'Fact Box': headers.some(h => /fact.?box|classification/i.test(h)),
                'Safety Info': headers.some(h => /safety|precaution/i.test(h)),
                'Primary Use': headers.some(h => /primary.?use|therapeutic.?use|indication|uses/i.test(h)),
                'Storage': headers.some(h => /storage/i.test(h)),
                'Q&A': headers.some(h => /q_a|q&a|faq|questions/i.test(h)) || !!firstRow['__EMPTY_8'],
                'How it works': headers.some(h => /how.?it.?works|mechanism/i.test(h)) || !!firstRow['__EMPTY_9'],
                'Drug Interactions': headers.some(h => /drug.*interact|interaction/i.test(h)) || !!firstRow['__EMPTY_10'],
                'Marketer Details': headers.some(h => /marketer.?details?|company.?address|address|^marketer.?d$/i.test(h)) || !!firstRow['__EMPTY_11'],
                'Image URLs': headers.some(h => /image|photo|picture/i.test(h)) || !!firstRow['__EMPTY_12']
            };

            // Smart normalize each row for medicine category
            const normalized = rawData.map(row => smartNormalizeRow(row))
                .filter(r => r.name && r.name !== 'Unnamed Medicine');

            // Compute quality stats
            const stats = {
                total: normalized.length,
                withProductId: normalized.filter(r => r.product_id).length,
                withImages: normalized.filter(r => r.image_urls && r.image_urls.length > 0).length,
                withMarketerDetails: normalized.filter(r => r.marketer_details).length,
                withPrimaryUse: normalized.filter(r => r.primary_use).length,
                withDrugInteractions: normalized.filter(r => r.drug_interactions).length,
                withQA: normalized.filter(r => r.q_a).length,
                withHowItWorks: normalized.filter(r => r.how_it_works).length,
                withSafety: normalized.filter(r => r.alcohol_interaction || r.safety_advise).length,
            };

            // Warnings / Info messages
            const warnings = [];
            if (isShifted) {
                warnings.push('✨ Auto-aligned legacy shifted format: Mapped Composition, Marketer, MRP, Form, Storage & Primary Use.');
                if (stats.withQA > 0 || stats.withHowItWorks > 0 || stats.withImages > 0) {
                    warnings.push(`✨ Successfully recovered clinical columns: ${stats.withQA} Q&A (FAQs), ${stats.withHowItWorks} How it Works, ${stats.withDrugInteractions} Drug Interactions, ${stats.withMarketerDetails} Marketer Addresses & ${stats.withImages} Product Images!`);
                }
            } else {
                warnings.push(`✨ Standard format detected: Verified all columns across ${stats.total} records.`);
                if (stats.withImages > 0) warnings.push(`🖼️ ${stats.withImages} products with image links.`);
                if (stats.withQA > 0) warnings.push(`❓ ${stats.withQA} products with Q&A FAQs.`);
                if (stats.withProductId < stats.total) warnings.push(`${stats.total - stats.withProductId} rows missing Product ID (will generate new records)`);
            }

            setParsedRows(normalized);
            setImportParseInfo({ colMap, stats, warnings, isShifted, sample: normalized[0], sheetName });
        } catch (err) {
            console.error('Error processing sheet:', err);
            setStatus({ type: 'error', message: 'Failed to read sheet: ' + err.message });
        }
    };

    const handleSwitchSheet = (sheetName) => {
        if (!workbookRef.current) return;
        setActiveSheetName(sheetName);
        processSheet(workbookRef.current, sheetName);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportingFile(file);
        setImportParseInfo(null);
        setAvailableSheets([]);
        setActiveSheetName('');

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                workbookRef.current = wb;

                const sheets = wb.SheetNames || [];
                setAvailableSheets(sheets);

                let defaultSheet = sheets[0];
                if (sheets.length > 1) {
                    const match = sheets.find(s => s.toLowerCase().includes(selectedCategory.toLowerCase())) ||
                                  sheets.find(s => s.toLowerCase().includes('drug')) ||
                                  sheets[0];
                    defaultSheet = match;
                }
                setActiveSheetName(defaultSheet);
                processSheet(wb, defaultSheet);
            } catch (err) {
                console.error('Error parsing spreadsheet:', err);
                setStatus({ type: 'error', message: 'Failed to read Excel/CSV file: ' + err.message });
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = async () => {
        if (!parsedRows.length) return;
        setImportLoading(true);
        try {
            const res = await bulkUpsertMasterData(parsedRows, selectedCategory);
            const d = res.data;
            const msg = d?.message || `Imported ${parsedRows.length} items!`;
            setStatus({ type: 'success', message: msg });
            setIsImporting(false);
            setImportingFile(null);
            setParsedRows([]);
            setImportParseInfo(null);
            loadData();
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Import failed';
            setStatus({ type: 'error', message: errorMsg });
        } finally {
            setImportLoading(false);
            setTimeout(() => setStatus({ type: '', message: '' }), 5000);
        }
    };

    const filteredData = data.filter(item => {
        const q = search.toLowerCase();
        return (
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.key_ingredients && item.key_ingredients.toLowerCase().includes(q)) ||
            (item.composition && item.composition.toLowerCase().includes(q)) ||
            (item.marketing_company && item.marketing_company.toLowerCase().includes(q)) ||
            (item.marketer && item.marketer.toLowerCase().includes(q)) ||
            (item.product_id && item.product_id.toLowerCase().includes(q)) ||
            (item.code && item.code.toLowerCase().includes(q)) ||
            (item.information && item.information.toLowerCase().includes(q)) ||
            (item.product_highlights && item.product_highlights.toLowerCase().includes(q))
        );
    });

    const activeCat = CATEGORIES.find(c => c.id === selectedCategory);

    return (
        <div className="master-data-page" style={{ padding: '24px', maxWidth: '100%', margin: '0 auto' }}>
            {/* Top Header */}
            <div className="header-v4" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Clinical Master Data</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, background: '#e0e7ff', color: '#4338ca', padding: '3px 10px', borderRadius: '20px' }}>
                            Prisma Postgres Live
                        </span>
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px', marginTop: '2px' }}>
                        19-Column Global Clinical Database for Medicines, Prescriptions & Formularies
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleDownloadTemplate}
                        title="Download 19-Column Sample Excel Template"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            background: '#fff',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            fontWeight: 700,
                            color: '#475569',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s',
                            fontSize: '13px'
                        }}
                    >
                        <Download size={16} color="#6366f1" />
                        <span>Template</span>
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={data.length === 0}
                        title="Export current data to 19-Column Excel"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            background: '#fff',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            fontWeight: 700,
                            color: '#059669',
                            cursor: data.length ? 'pointer' : 'not-allowed',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s',
                            fontSize: '13px'
                        }}
                    >
                        <FileSpreadsheet size={16} color="#059669" />
                        <span>Export Excel ({data.length})</span>
                    </button>

                    {data.length > 0 && (
                        <button
                            onClick={handleClearCategory}
                            title={`Clear all ${activeCat.name.toLowerCase()} from database`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 14px',
                                background: '#fff',
                                border: '1.5px solid #fecaca',
                                borderRadius: '10px',
                                fontWeight: 700,
                                color: '#dc2626',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                fontSize: '13px'
                            }}
                        >
                            <Trash2 size={16} color="#dc2626" />
                            <span>Clear All ({data.length})</span>
                        </button>
                    )}

                    <button
                        onClick={() => setIsImporting(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s',
                            fontSize: '13px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = activeCat.color}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                    >
                        <UploadCloud size={18} color={activeCat.color} />
                        <span>Import Excel / CSV</span>
                    </button>

                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            background: activeCat.color,
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 700,
                            color: '#fff',
                            cursor: 'pointer',
                            boxShadow: `0 4px 12px ${activeCat.color}40`,
                            transition: 'all 0.2s',
                            fontSize: '13px'
                        }}
                    >
                        <Plus size={18} />
                        <span>Add {activeCat.name.slice(0, -1)}</span>
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
                {/* Categories Sidebar */}
                <aside style={{ background: '#fff', borderRadius: '16px', padding: '16px', height: 'fit-content', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', paddingLeft: '8px', letterSpacing: '0.05em' }}>
                        Categories
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {CATEGORIES.map(cat => {
                            const isSelected = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setSelectedCategory(cat.id);
                                        setSearch('');
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        width: '100%',
                                        padding: '12px 14px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: isSelected ? `${cat.color}15` : 'transparent',
                                        color: isSelected ? cat.color : '#475569',
                                        fontWeight: isSelected ? 800 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        textAlign: 'left'
                                    }}
                                >
                                    <cat.icon size={18} />
                                    <span>{cat.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main style={{ minWidth: 0 }}>
                    <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        {/* Search & Stats Bar */}
                        <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', gap: '16px', alignItems: 'center', background: '#fafbfc', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeCat.name.toLowerCase()} by name, composition, Product ID...`}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px 10px 42px', borderRadius: '10px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', background: '#fff' }}
                                />
                            </div>

                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                                Showing {filteredData.length} of {data.length} {data.length === 1 ? 'record' : 'records'}
                            </div>

                            <button
                                onClick={loadData}
                                title="Refresh data from Postgres"
                                style={{ padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b' }}
                            >
                                <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                            </button>
                        </div>

                        {/* List / Table */}
                        <div style={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
                            {loading && (
                                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                                    <Loader2 size={36} className="spinning" style={{ margin: '0 auto 12px', color: activeCat.color }} />
                                    <p style={{ fontWeight: 600 }}>Loading {activeCat.name} from Postgres...</p>
                                </div>
                            )}

                            {!loading && filteredData.length === 0 && (
                                <div style={{ padding: '80px 40px', textAlign: 'center', color: '#94a3b8' }}>
                                    <activeCat.icon size={56} style={{ margin: '0 auto 16px', opacity: 0.35, color: activeCat.color }} />
                                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>No {activeCat.name.toLowerCase()} found</h4>
                                    <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '360px', margin: '0 auto 20px' }}>
                                        Import your 19-column Excel spreadsheet or click below to add an entry manually.
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => setIsImporting(true)}
                                            style={{ color: activeCat.color, fontWeight: 700, background: '#f8fafc', border: '1.5px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                                        >
                                            Import Excel
                                        </button>
                                        <button
                                            onClick={() => setIsAdding(true)}
                                            style={{ color: '#fff', background: activeCat.color, fontWeight: 700, border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                                        >
                                            + Add New
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!loading && filteredData.length > 0 && selectedCategory === 'medicine' && (
                                <div style={{ overflowX: 'auto', width: '100%' }}>
                                    <table style={{ width: '100%', minWidth: '3500px', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10, borderBottom: '2px solid #e2e8f0' }}>
                                            <tr>
                                                {MEDICINE_COLUMNS.map(col => (
                                                    <th
                                                        key={col.key}
                                                        style={{
                                                            padding: '14px 14px',
                                                            fontSize: '12px',
                                                            fontWeight: 800,
                                                            color: '#334155',
                                                            whiteSpace: 'nowrap',
                                                            width: col.width,
                                                            minWidth: col.width,
                                                            maxWidth: col.width,
                                                            borderRight: '1px solid #e2e8f0',
                                                            letterSpacing: '0.2px'
                                                        }}
                                                    >
                                                        {col.label}
                                                    </th>
                                                ))}
                                                <th style={{ padding: '14px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', width: '120px', minWidth: '120px', position: 'sticky', right: 0, background: '#f8fafc', boxShadow: '-2px 0 6px rgba(0,0,0,0.03)' }}>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData.map(item => {
                                                const itemId = item.id || item._id;
                                                return (
                                                    <tr
                                                        key={itemId}
                                                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        {MEDICINE_COLUMNS.map(col => {
                                                            const isMultiLine = col.key === 'Image_Urls' || col.key === 'Q_A' || col.key === 'Fact_Box' || col.key.includes('Interaction');

                                                            return (
                                                                <td
                                                                    key={col.key}
                                                                    style={{
                                                                        padding: '12px 14px',
                                                                        fontSize: '13px',
                                                                        color: '#334155',
                                                                        width: col.width,
                                                                        minWidth: col.width,
                                                                        maxWidth: col.width,
                                                                        whiteSpace: isMultiLine ? 'normal' : 'nowrap',
                                                                        overflow: isMultiLine ? 'visible' : 'hidden',
                                                                        textOverflow: isMultiLine ? 'clip' : 'ellipsis',
                                                                        verticalAlign: 'middle',
                                                                        borderRight: '1px solid #f1f5f9'
                                                                    }}
                                                                >
                                                                    {col.render(item)}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: '#fff', boxShadow: '-2px 0 6px rgba(0,0,0,0.03)' }}>
                                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                                <button
                                                                    onClick={() => setViewingItem(item)}
                                                                    title="View All 32 Column Details"
                                                                    style={{ color: '#6366f1', background: '#e0e7ff', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
                                                                >
                                                                    <Eye size={13} />
                                                                    <span>Details</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(itemId)}
                                                                    title="Delete Medicine"
                                                                    style={{ color: '#ef4444', background: '#fee2e2', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px' }}
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filteredData.length > 0 && selectedCategory !== 'medicine' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1.5px solid #e2e8f0' }}>
                                        <tr>
                                            <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Name</th>
                                            {selectedCategory === 'diagnosis' && <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ICD-10 Code</th>}
                                            <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Notes / Description</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map(item => {
                                            const itemId = item.id || item._id;
                                            return (
                                                <tr key={itemId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                                                    {selectedCategory === 'diagnosis' && (
                                                        <td style={{ padding: '14px 20px', color: '#64748b' }}>
                                                            <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                                                                {item.code || item.metadata?.code || '-'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>
                                                        {item.information || item.introduction || item.metadata?.notes || '-'}
                                                    </td>
                                                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleDelete(itemId)}
                                                            style={{ color: '#ef4444', background: '#fee2e2', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px' }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Medicine Detail View Drawer/Modal - Showing all 19 columns */}
            {viewingItem && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setViewingItem(null)}>
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '780px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
                            <div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                        {viewingItem.product_form || 'Medicine'}
                                    </span>
                                    {viewingItem.product_id && (
                                        <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, background: '#eef2ff', color: '#6366f1', padding: '3px 8px', borderRadius: '4px' }}>
                                            {viewingItem.product_id}
                                        </span>
                                    )}
                                </div>
                                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{viewingItem.name}</h2>
                                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>{viewingItem.key_ingredients || viewingItem.composition || '-'}</p>
                            </div>
                            <button onClick={() => setViewingItem(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        {/* 32 Complete Clinical Master Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Product ID</span>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>{viewingItem.product_id || viewingItem.code || '-'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Category</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.category || 'medicine'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Marketer / Company</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.marketing_company || viewingItem.marketer || '-'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>medicine_type</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px', textTransform: 'capitalize' }}>{viewingItem.medicine_type || viewingItem.type || 'drugs'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Packaging Detail</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.packaging_detail || viewingItem.packaging || '-'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Package</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.package || viewingItem.package_type || '-'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Qty</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.qty != null ? String(viewingItem.qty) : '-'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Product Form</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.product_form || '-'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>MRP</span>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                                    {viewingItem.mrp != null ? `₹${viewingItem.mrp}` : '-'}
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>prescription_required</span>
                                <div style={{ marginTop: '2px' }}>
                                    {viewingItem.prescription_required ? (
                                        <span style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Prescription Required</span>
                                    ) : (
                                        <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>OTC (Not Required)</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>country_of_origin</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.country_of_origin || '-'}</div>
                            </div>
                            {viewingItem.primary_use && (
                                <div>
                                    <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, display: 'block' }}>primary_use</span>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1', marginTop: '2px' }}>{viewingItem.primary_use}</div>
                                </div>
                            )}
                            {viewingItem.storage && (
                                <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>storage</span>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{viewingItem.storage}</div>
                                </div>
                            )}
                        </div>

                        {/* Fact_Box (Pharmaceutical Classification) */}
                        {(() => {
                            const factList = parseFactBox(viewingItem.fact_box);
                            if (!factList.length && !viewingItem.fact_box) return null;
                            return (
                                <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Info size={16} color="#4f46e5" />
                                            <span>Fact_Box (Pharmaceutical Classification)</span>
                                            {factList.length > 0 && (
                                                <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                                    {factList.length} Facts
                                                </span>
                                            )}
                                        </h4>
                                    </div>
                                    {factList.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                                            {factList.map((fact, fIdx) => {
                                                const isHabit = fact.label.toLowerCase().includes('habit');
                                                const isNo = fact.value.toLowerCase() === 'no';
                                                return (
                                                    <div key={fIdx} style={{ background: '#ffffff', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                            {fact.label}
                                                        </span>
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: isHabit ? (isNo ? '#16a34a' : '#dc2626') : '#0f172a', lineHeight: 1.4 }}>
                                                            {fact.value}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            {viewingItem.fact_box}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Safety Advisories & Drug Interactions (6 Dedicated Cards) */}
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>Safety Advisories & Interactions</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '10px' }}>
                                    Clinical Safety
                                </span>
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {(() => {
                                    const fallbackMap = parseSafetyInteractions(viewingItem.safety_advise || viewingItem.safety_information);
                                    return [
                                        { key: 'alcoholInteraction', label: 'Alcohol', icon: '🍷', val: (viewingItem.alcohol_interaction && viewingItem.alcohol_interaction.length > 25) ? viewingItem.alcohol_interaction : (fallbackMap.alcohol_interaction || viewingItem.alcohol_interaction) },
                                        { key: 'pregnancyInteraction', label: 'Pregnancy', icon: '🤰', val: (viewingItem.pregnancy_interaction && viewingItem.pregnancy_interaction.length > 25) ? viewingItem.pregnancy_interaction : (fallbackMap.pregnancy_interaction || viewingItem.pregnancy_interaction) },
                                        { key: 'lactationInteraction', label: 'Breast feeding', icon: '🤱', val: (viewingItem.lactation_interaction && viewingItem.lactation_interaction.length > 25) ? viewingItem.lactation_interaction : (fallbackMap.lactation_interaction || viewingItem.lactation_interaction) },
                                        { key: 'drivingInteraction', label: 'Driving', icon: '🚗', val: (viewingItem.driving_interaction && viewingItem.driving_interaction.length > 25) ? viewingItem.driving_interaction : (fallbackMap.driving_interaction || viewingItem.driving_interaction) },
                                        { key: 'kidneyInteraction', label: 'Kidney', icon: '🩺', val: (viewingItem.kidney_interaction && viewingItem.kidney_interaction.length > 25) ? viewingItem.kidney_interaction : (fallbackMap.kidney_interaction || viewingItem.kidney_interaction) },
                                        { key: 'liverInteraction', label: 'Liver', icon: '🫁', val: (viewingItem.liver_interaction && viewingItem.liver_interaction.length > 25) ? viewingItem.liver_interaction : (fallbackMap.liver_interaction || viewingItem.liver_interaction) }
                                    ].map((item) => {
                                        const { status, desc } = parseSafetyStatus(item.val);
                                        const style = getStatusBadgeStyle(status);
                                        return (
                                            <div key={item.key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>{item.icon}</span>
                                                        <span>{item.label}</span>
                                                    </span>
                                                    {status && (
                                                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                                                            {status}
                                                        </span>
                                                    )}
                                                </div>
                                                {desc ? (
                                                    <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                                                        {desc}
                                                    </p>
                                                ) : (
                                                    <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                                                        No specific precaution notes reported.
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {viewingItem.side_effects && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', marginBottom: '4px' }}>side_effect</h4>
                                <div style={{ fontSize: '13px', color: '#991b1b', background: '#fff1f2', border: '1px solid #ffe4e6', padding: '10px 14px', borderRadius: '8px', lineHeight: 1.5 }}>
                                    {viewingItem.side_effects}
                                </div>
                            </div>
                        )}

                        {viewingItem.if_miss && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>if_miss (Missed Dose Instructions)</h4>
                                <div style={{ fontSize: '13px', color: '#334155', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                                    {viewingItem.if_miss}
                                </div>
                            </div>
                        )}

                        {(viewingItem.information || viewingItem.introduction) && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Introduction / Information</h4>
                                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, background: '#fff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                                    {viewingItem.information || viewingItem.introduction}
                                </div>
                            </div>
                        )}

                        {(viewingItem.key_benefits || viewingItem.benefits) && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Benefits</h4>
                                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, background: '#fff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                                    {viewingItem.key_benefits || viewingItem.benefits}
                                </div>
                            </div>
                        )}

                        {(viewingItem.directions_for_use || viewingItem.how_to_use) && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>how_to_use</h4>
                                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, background: '#fff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                                    {viewingItem.directions_for_use || viewingItem.how_to_use}
                                </div>
                            </div>
                        )}

                        {viewingItem.how_it_works && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>How it works</h4>
                                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    {viewingItem.how_it_works}
                                </div>
                            </div>
                        )}

                        {(() => {
                            const rawDrug = viewingItem.drug_interactions;
                            if (!rawDrug) return null;
                            const interactions = parseDrugInteractions(rawDrug);

                            return (
                                <div style={{ marginBottom: '20px', background: '#fff5f5', padding: '16px', borderRadius: '12px', border: '1.5px solid #fecaca' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertCircle size={16} color="#dc2626" />
                                            <span>drug-drug Interaction</span>
                                            <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                                {interactions.length} {interactions.length === 1 ? 'Interaction' : 'Interactions'}
                                            </span>
                                        </h4>
                                    </div>

                                    {interactions.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                                            {interactions.map((inter, idx) => {
                                                const sevStyle = getSeverityBadgeStyle(inter.severity);
                                                return (
                                                    <div key={idx} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #fed7d7', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ color: '#dc2626' }}>💊</span>
                                                                <span>{inter.drugName}</span>
                                                            </span>
                                                            {inter.severity && (
                                                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: sevStyle.bg, color: sevStyle.color, border: `1px solid ${sevStyle.border}`, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                                                    {inter.severity}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {inter.details && (
                                                            <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6, paddingLeft: '22px' }}>
                                                                {inter.details}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12.5px', color: '#7f1d1d', lineHeight: 1.5, background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                            {String(rawDrug).replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim()}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {(() => {
                            const qaList = parseQA(viewingItem.q_a);
                            if (!qaList.length && !viewingItem.q_a) return null;
                            return (
                                <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <HelpCircle size={16} color="#4f46e5" />
                                            <span>Q_A (Questions & Answers)</span>
                                            <span style={{ fontSize: '11px', background: qaList.length ? '#e0e7ff' : '#f1f5f9', color: qaList.length ? '#4338ca' : '#64748b', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                                {qaList.length} FAQ{qaList.length === 1 ? '' : 's'}
                                            </span>
                                        </h4>
                                    </div>
                                    {qaList.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                                            {qaList.map((qa, qIdx) => (
                                                <div key={qIdx} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '2px 7px', borderRadius: '4px', flexShrink: 0, border: '1px solid #c7d2fe' }}>
                                                            Q{qIdx + 1}
                                                        </span>
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                                                            {qa.question}
                                                        </span>
                                                    </div>
                                                    <div style={{ paddingLeft: '34px', fontSize: '12.5px', color: '#334155', lineHeight: 1.6 }}>
                                                        {qa.answer}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            {viewingItem.q_a}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {viewingItem.marketer_details && viewingItem.marketer_details !== viewingItem.primary_use && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Marketer details</h4>
                                <div style={{ fontSize: '13px', color: '#334155', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                                    {viewingItem.marketer_details}
                                </div>
                            </div>
                        )}

                        {(() => {
                            const urls = extractImageUrls(viewingItem);
                            return (
                                <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ImageIcon size={16} color="#4f46e5" />
                                            <span>Product Images & Links (Image_Urls)</span>
                                            <span style={{ fontSize: '11px', background: urls.length ? '#e0e7ff' : '#f1f5f9', color: urls.length ? '#4338ca' : '#64748b', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                                {urls.length} {urls.length === 1 ? 'image' : 'images'}
                                            </span>
                                        </h4>
                                    </div>

                                    {urls.length > 0 ? (
                                        <>
                                            {/* Visual Image Gallery */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                                {urls.map((imgUrl, idx) => (
                                                    <div key={idx} style={{ background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                        <div style={{ height: '110px', width: '100%', borderRadius: '6px', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <img
                                                                src={imgUrl}
                                                                alt={`Product ${idx + 1}`}
                                                                referrerPolicy="no-referrer"
                                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Image {idx + 1}</span>
                                                            <a
                                                                href={imgUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                title={`Open Image ${idx + 1}`}
                                                                style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: '#eff6ff', padding: '3px 8px', borderRadius: '5px', border: '1px solid #bfdbfe' }}
                                                            >
                                                                <span>Open</span>
                                                                <ExternalLink size={10} />
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                                            No image links associated with this product.
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div style={{ textAlign: 'right', marginTop: '24px' }}>
                            <button
                                onClick={() => setViewingItem(null)}
                                style={{ padding: '10px 20px', borderRadius: '10px', background: '#0f172a', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Excel / CSV Modal */}
            {isImporting && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Smart Import — Excel / CSV</h2>
                                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Auto-detects &amp; normalizes all 32 pharmaceutical columns automatically</p>
                            </div>
                            <button onClick={() => { setIsImporting(false); setParsedRows([]); setImportingFile(null); setImportParseInfo(null); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        {/* File Dropzone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: importingFile ? '2px solid #6366f1' : '2px dashed #cbd5e1',
                                borderRadius: '14px',
                                padding: importingFile ? '20px' : '36px 20px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: importingFile ? '#f5f3ff' : '#fafbfc',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = importingFile ? '#6366f1' : '#cbd5e1'}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".xlsx,.xls,.csv"
                                style={{ display: 'none' }}
                            />
                            <FileSpreadsheet size={importingFile ? 28 : 44} style={{ margin: '0 auto 10px', color: '#6366f1' }} />
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                                {importingFile ? importingFile.name : 'Click to select or drag & drop Excel file'}
                            </div>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                {importingFile ? 'Click to change file' : 'Supports .xlsx, .xls, .csv — any column naming convention'}
                            </p>
                        </div>

                        {/* Multi-Sheet Selector */}
                        {availableSheets.length > 1 && (
                            <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>📑 Select Sheet ({availableSheets.length} Sheets in file)</span>
                                    <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700 }}>Active: {activeSheetName}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {availableSheets.map(s => {
                                        const isSelected = activeSheetName === s;
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => handleSwitchSheet(s)}
                                                style={{
                                                    padding: '7px 16px',
                                                    borderRadius: '8px',
                                                    border: isSelected ? '1.5px solid #6366f1' : '1.5px solid #cbd5e1',
                                                    background: isSelected ? '#6366f1' : '#ffffff',
                                                    color: isSelected ? '#ffffff' : '#334155',
                                                    fontWeight: 700,
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: isSelected ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <span>{s}</span>
                                                {isSelected && <CheckCircle2 size={13} color="#fff" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Smart Parse Preview */}
                        {parsedRows.length > 0 && importParseInfo && (
                            <div style={{ marginTop: '18px' }}>
                                {/* Success Banner */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
                                    <CheckCircle2 size={20} color="#16a34a" />
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#14532d', fontSize: '14px' }}>
                                            ✅ Smart parsing complete — {importParseInfo.stats.total} medicine record{importParseInfo.stats.total !== 1 ? 's' : ''} ready
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                                            Sample: <strong>{importParseInfo.sample?.name}</strong>{importParseInfo.sample?.composition ? ` (${importParseInfo.sample.composition.substring(0, 40)})` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Column Detection */}
                                <div style={{ marginBottom: '14px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>🔍 Auto-Detected Columns</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {Object.entries(importParseInfo.colMap).map(([col, detected]) => (
                                            <span key={col} style={{
                                                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                                                background: detected ? '#f0fdf4' : '#f8fafc',
                                                color: detected ? '#15803d' : '#94a3b8',
                                                border: `1px solid ${detected ? '#86efac' : '#e2e8f0'}`
                                            }}>
                                                {detected ? '✓' : '○'} {col}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Data Quality Stats Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                                    {[
                                        { label: 'Product IDs', val: importParseInfo.stats.withProductId, icon: '🏷️' },
                                        { label: 'Images', val: importParseInfo.stats.withImages, icon: '🖼️' },
                                        { label: 'Q&A', val: importParseInfo.stats.withQA, icon: '❓' },
                                        { label: 'How it Works', val: importParseInfo.stats.withHowItWorks, icon: '⚙️' },
                                        { label: 'Drug Interactions', val: importParseInfo.stats.withDrugInteractions, icon: '⚠️' },
                                        importParseInfo.isShifted
                                            ? { label: 'Primary Uses', val: importParseInfo.stats.withPrimaryUse, icon: '🎯' }
                                            : { label: 'Marketer Details', val: importParseInfo.stats.withMarketerDetails, icon: '🏢' },
                                        { label: 'Safety Info', val: importParseInfo.stats.withSafety, icon: '🛡️' },
                                        { label: 'Total Records', val: importParseInfo.stats.total, icon: '📋', highlight: true },
                                    ].map(({ label, val, icon, highlight }) => (
                                        <div key={label} style={{
                                            background: highlight ? '#6366f1' : '#f8fafc',
                                            border: `1px solid ${highlight ? '#6366f1' : '#e2e8f0'}`,
                                            borderRadius: '10px', padding: '10px', textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '16px', marginBottom: '2px' }}>{icon}</div>
                                            <div style={{ fontWeight: 800, fontSize: '18px', color: highlight ? '#fff' : '#0f172a' }}>{val}</div>
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: highlight ? '#c7d2fe' : '#64748b', marginTop: '1px' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Warnings */}
                                {importParseInfo.warnings.length > 0 && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px' }}>
                                        <div style={{ fontWeight: 700, color: '#92400e', fontSize: '12px', marginBottom: '4px' }}>⚠️ Import Information</div>
                                        {importParseInfo.warnings.map((w, i) => (
                                            <div key={i} style={{ fontSize: '12px', color: '#78350f' }}>• {w}</div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    💡 <strong>Smart import</strong> will automatically <strong>update</strong> existing medicines (by Product ID) or <strong>create</strong> new ones. No duplicates.
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button
                                onClick={handleConfirmImport}
                                disabled={parsedRows.length === 0 || importLoading}
                                style={{
                                    flex: 2, padding: '12px', borderRadius: '10px',
                                    background: parsedRows.length > 0 ? '#6366f1' : '#cbd5e1',
                                    color: '#fff', border: 'none', fontWeight: 700,
                                    cursor: parsedRows.length > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {importLoading ? <Loader2 size={18} className="spinning" /> : <Save size={18} />}
                                <span>{importLoading ? 'Importing to Database...' : `Smart Import ${parsedRows.length || ''} Medicines`}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsImporting(false); setParsedRows([]); setImportingFile(null); setImportParseInfo(null); }}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Single Item Modal */}
            {isAdding && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: selectedCategory === 'medicine' ? '1060px' : '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px -15px rgba(15,23,42,0.35)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafafa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${activeCat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${activeCat.color}30` }}>
                                    {selectedCategory === 'medicine' ? <Pill size={22} color={activeCat.color} /> : <activeCat.icon size={22} color={activeCat.color} />}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Add New {activeCat.name.slice(0, -1)}</h2>
                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: `${activeCat.color}15`, color: activeCat.color }}>
                                            {activeCat.name}
                                        </span>
                                        {selectedCategory === 'medicine' && (
                                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca' }}>
                                                32 Standard Columns
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                                        {selectedCategory === 'medicine' ? 'Fill pharmaceutical details across the 32 standard clinical columns' : 'Add new record to clinical master dataset'}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {selectedCategory === 'medicine' && (
                                    <div style={{ position: 'relative', width: '220px' }}>
                                        <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                                        <input
                                            type="text"
                                            placeholder="Find field e.g. storage..."
                                            value={formFieldSearch}
                                            onChange={e => setFormFieldSearch(e.target.value)}
                                            style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#ffffff' }}
                                        />
                                    </div>
                                )}
                                <button onClick={() => { setIsAdding(false); setFormFieldSearch(''); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={20} color="#64748b" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Form Body */}
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

                                {selectedCategory !== 'medicine' ? (
                                    /* Non-Medicine Simple Form */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Name <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder={`e.g. ${activeCat.name.slice(0, -1)} name`}
                                                value={newItem.name}
                                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '14px', fontWeight: 600 }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Code / ID
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. ICD10-A00 or Code"
                                                value={newItem.product_id}
                                                onChange={e => setNewItem({ ...newItem, product_id: e.target.value, code: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '13px', fontFamily: 'monospace' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Description / Notes
                                            </label>
                                            <textarea
                                                rows={4}
                                                placeholder="Clinical notes, guidelines, or details..."
                                                value={newItem.notes}
                                                onChange={e => setNewItem({ ...newItem, notes: e.target.value, information: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '13px', resize: 'vertical' }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Medicine 32-Column Standard Sequential Form */
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>

                                        {/* Helper for visibility filter */}
                                        {(() => {
                                            const q = formFieldSearch.trim().toLowerCase();
                                            const matches = (label, colNum) => !q || label.toLowerCase().includes(q) || `col ${colNum}`.includes(q) || `#${colNum}`.includes(q);

                                            const cardStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' };
                                            const labelRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' };
                                            const labelStyle = { fontSize: '12px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' };
                                            const numBadge = (n) => <span style={{ fontSize: '10px', fontWeight: 800, background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px' }}>#{n}</span>;
                                            const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '13px', background: '#fff' };
                                            const textareaStyle = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '13px', background: '#fff', resize: 'vertical' };

                                            return (
                                                <>
                                                    {/* #1 Product ID */}
                                                    {matches('Product ID', 1) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(1)} Product ID</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Code / SKU</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. DRS003256"
                                                                value={newItem.product_id}
                                                                onChange={e => setNewItem({ ...newItem, product_id: e.target.value, code: e.target.value })}
                                                                style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700, color: '#4338ca' }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #2 Product Name */}
                                                    {matches('Product Name', 2) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(2)} Product Name <span style={{ color: '#ef4444' }}>*</span></span>
                                                                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>Required</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder="e.g. Acenac Tablet"
                                                                value={newItem.name}
                                                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                                                style={{ ...inputStyle, fontWeight: 700, color: '#0f172a' }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #3 Marketer */}
                                                    {matches('Marketer', 3) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(3)} Marketer</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Brand / Manufacturer</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Medley Pharmaceuticals"
                                                                value={newItem.marketer}
                                                                onChange={e => setNewItem({ ...newItem, marketer: e.target.value, marketing_company: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #4 Composition */}
                                                    {matches('Composition', 4) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(4)} Composition</span>
                                                                <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>Active Ingredients / Molecules</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Add single molecule e.g. Aceclofenac (100mg)"
                                                                    value={multiInputs.newIngredient}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newIngredient: e.target.value })}
                                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddIngredient(); } }}
                                                                    style={{ ...inputStyle, flex: 1 }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleAddIngredient}
                                                                    style={{ padding: '8px 14px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 700, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                                >
                                                                    + Add Molecule
                                                                </button>
                                                            </div>
                                                            {/* Chips */}
                                                            {(() => {
                                                                const ingredients = (newItem.composition || '').split('+').map(s => s.trim()).filter(Boolean);
                                                                if (!ingredients.length) return null;
                                                                return (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                                                                        {ingredients.map((ing, idx) => (
                                                                            <span key={idx} style={{ fontSize: '11px', background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                                                                <span>{ing}</span>
                                                                                <button type="button" onClick={() => handleRemoveIngredient(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6366f1', fontWeight: 800, fontSize: '12px' }}>✕</button>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                            <input
                                                                type="text"
                                                                placeholder="Or type full composition: Aceclofenac (100mg) + Paracetamol (325mg)"
                                                                value={newItem.composition}
                                                                onChange={e => setNewItem({ ...newItem, composition: e.target.value, key_ingredients: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #5 medicine_type */}
                                                    {matches('medicine_type', 5) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(5)} medicine_type</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>e.g. drugs</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. drugs"
                                                                value={newItem.medicine_type}
                                                                onChange={e => setNewItem({ ...newItem, medicine_type: e.target.value, type: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #6 Introduction */}
                                                    {matches('Introduction', 6) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(6)} Introduction</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Clinical Overview</span>
                                                            </div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="e.g. Acenac Tablet is a pain-relieving medicine. It alleviates pain and inflammation in conditions such as rheumatoid arthritis, ankylosing spondylitis, osteoarthritis..."
                                                                value={newItem.introduction}
                                                                onChange={e => setNewItem({ ...newItem, introduction: e.target.value, information: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #7 Benefits */}
                                                    {matches('Benefits', 7) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(7)} Benefits</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Key Indications</span>
                                                            </div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="e.g. In Pain relief: relieves pain, swelling, and inflammation in joints and muscles. It works by blocking chemical messengers in the brain..."
                                                                value={newItem.benefits}
                                                                onChange={e => setNewItem({ ...newItem, benefits: e.target.value, key_benefits: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #8 how_to_use */}
                                                    {matches('how_to_use', 8) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(8)} how_to_use</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Directions for Use</span>
                                                            </div>
                                                            <textarea
                                                                rows={2}
                                                                placeholder="e.g. Take this medicine in the dose and duration advised by your doctor. Swallow it as a whole with food or milk to prevent stomach upset..."
                                                                value={newItem.how_to_use}
                                                                onChange={e => setNewItem({ ...newItem, how_to_use: e.target.value, directions_for_use: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #9 safety_advise */}
                                                    {matches('safety_advise', 9) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(9)} safety_advise</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Full Overview & Clinical Warnings</span>
                                                            </div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="e.g. - Alcohol : CONSULT YOUR DOCTOR It is not known whether it is safe... | - Pregnancy : CONSULT YOUR DOCTOR ... | - Driving : UNSAFE ..."
                                                                value={newItem.safety_advise}
                                                                onChange={e => setNewItem({ ...newItem, safety_advise: e.target.value, safety_information: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #10 if_miss */}
                                                    {matches('if_miss', 10) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(10)} if_miss</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Missed Dose Instructions</span>
                                                            </div>
                                                            <textarea
                                                                rows={2}
                                                                placeholder="e.g. If you miss a dose of Acenac Tablet, take it as soon as you remember. If it is close to your next dose, skip the missed dose. Do not double the dose."
                                                                value={newItem.if_miss}
                                                                onChange={e => setNewItem({ ...newItem, if_miss: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #11 Packaging Detail */}
                                                    {matches('Packaging Detail', 11) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(11)} Packaging Detail</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. strip of 10 tablets"
                                                                value={newItem.packaging_detail}
                                                                onChange={e => setNewItem({ ...newItem, packaging_detail: e.target.value, packaging: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #12 Package */}
                                                    {matches('Package', 12) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(12)} Package</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Package Type</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Strip, Bottle, Box"
                                                                value={newItem.package}
                                                                onChange={e => setNewItem({ ...newItem, package: e.target.value, package_type: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #13 Qty */}
                                                    {matches('Qty', 13) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(13)} Qty</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Quantity</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. 10 or 100 ml"
                                                                value={newItem.qty}
                                                                onChange={e => setNewItem({ ...newItem, qty: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #14 Product Form */}
                                                    {matches('Product Form', 14) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(14)} Product Form</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Dosage Form</span>
                                                            </div>
                                                            <select
                                                                value={newItem.product_form}
                                                                onChange={e => setNewItem({ ...newItem, product_form: e.target.value })}
                                                                style={{ ...inputStyle, cursor: 'pointer' }}
                                                            >
                                                                <option value="Tablet">Tablet</option>
                                                                <option value="Capsule">Capsule</option>
                                                                <option value="Syrup">Syrup</option>
                                                                <option value="Injection">Injection</option>
                                                                <option value="Suspension">Suspension</option>
                                                                <option value="Cream/Ointment">Cream / Ointment</option>
                                                                <option value="Gel">Gel</option>
                                                                <option value="Eye Drop">Eye Drop</option>
                                                                <option value="Drops">Drops</option>
                                                                <option value="Inhaler">Inhaler</option>
                                                                <option value="Lotion">Lotion</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* #15 MRP */}
                                                    {matches('MRP', 15) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(15)} MRP (₹)</span>
                                                                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Price</span>
                                                            </div>
                                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                                <span style={{ position: 'absolute', left: '10px', fontSize: '13px', fontWeight: 700, color: '#059669' }}>₹</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="55.78"
                                                                    value={newItem.mrp}
                                                                    onChange={e => setNewItem({ ...newItem, mrp: e.target.value })}
                                                                    style={{ ...inputStyle, paddingLeft: '24px', fontWeight: 700, color: '#059669' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* #16 prescription_required */}
                                                    {matches('prescription_required', 16) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(16)} prescription_required</span>
                                                            </div>
                                                            <select
                                                                value={newItem.prescription_required ? 'true' : 'false'}
                                                                onChange={e => setNewItem({ ...newItem, prescription_required: e.target.value === 'true' })}
                                                                style={{ ...inputStyle, cursor: 'pointer' }}
                                                            >
                                                                <option value="true">Prescription Required (Rx)</option>
                                                                <option value="false">Over the Counter (OTC)</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* #17 Fact_Box */}
                                                    {matches('Fact_Box', 17) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(17)} Fact_Box</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Pharmaceutical Classification</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                                                <button type="button" onClick={() => handleAddFact('Chemical Class', 'Dichlorobenzenes')} style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Chemical Class</button>
                                                                <button type="button" onClick={() => handleAddFact('Habit Forming', 'No')} style={{ fontSize: '11px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Habit Forming: No</button>
                                                                <button type="button" onClick={() => handleAddFact('Habit Forming', 'Yes')} style={{ fontSize: '11px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Habit Forming: Yes</button>
                                                                <button type="button" onClick={() => handleAddFact('Therapeutic Class', 'PAIN ANALGESICS')} style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Therapeutic Class</button>
                                                                <button type="button" onClick={() => handleAddFact('Action Class', "NSAID's")} style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Action Class</button>
                                                            </div>
                                                            <textarea
                                                                rows={2}
                                                                placeholder="e.g. Chemical Class :: Dichlorobenzenes | Habit Forming :: No | Therapeutic Class :: PAIN ANALGESICS | Action Class :: NSAID's"
                                                                value={newItem.fact_box}
                                                                onChange={e => setNewItem({ ...newItem, fact_box: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #18 primary_use */}
                                                    {matches('primary_use', 18) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(18)} primary_use</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Primary Indication</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Add indication e.g. Pain relief"
                                                                    value={multiInputs.newPrimaryUse}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newPrimaryUse: e.target.value })}
                                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPrimaryUse(); } }}
                                                                    style={{ ...inputStyle, flex: 1 }}
                                                                />
                                                                <button type="button" onClick={handleAddPrimaryUse} style={{ padding: '6px 12px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>+ Add</button>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Pain relief, Osteoarthritis, Rheumatoid arthritis"
                                                                value={newItem.primary_use}
                                                                onChange={e => setNewItem({ ...newItem, primary_use: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #19 storage */}
                                                    {matches('storage', 19) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(19)} storage</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Storage Instructions</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Store below 25°C"
                                                                value={newItem.storage}
                                                                onChange={e => setNewItem({ ...newItem, storage: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #20 side_effect */}
                                                    {matches('side_effect', 20) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(20)} side_effect</span>
                                                                <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>Adverse Effects</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Add side effect e.g. Dizziness"
                                                                    value={multiInputs.newSideEffect}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newSideEffect: e.target.value })}
                                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSideEffect(); } }}
                                                                    style={{ ...inputStyle, flex: 1 }}
                                                                />
                                                                <button type="button" onClick={handleAddSideEffect} style={{ padding: '6px 12px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>+ Add</button>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Dizziness, Nausea, Diarrhea, Abdominal pain, Increased liver enzymes"
                                                                value={newItem.side_effect || newItem.side_effects}
                                                                onChange={e => setNewItem({ ...newItem, side_effect: e.target.value, side_effects: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #21 alcoholInteraction */}
                                                    {matches('alcoholInteraction', 21) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(21)} alcoholInteraction 🍷</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. CONSULT YOUR DOCTOR: It is not known whether it is safe to consume alcohol with this medicine..."
                                                                value={newItem.alcoholInteraction || newItem.alcohol_interaction}
                                                                onChange={e => setNewItem({ ...newItem, alcoholInteraction: e.target.value, alcohol_interaction: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #22 pregnancyInteraction */}
                                                    {matches('pregnancyInteraction', 22) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(22)} pregnancyInteraction 🤰</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. CONSULT YOUR DOCTOR: Not recommended during pregnancy as there is positive evidence of fetal risk..."
                                                                value={newItem.pregnancyInteraction || newItem.pregnancy_interaction}
                                                                onChange={e => setNewItem({ ...newItem, pregnancyInteraction: e.target.value, pregnancy_interaction: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #23 lactationInteraction */}
                                                    {matches('lactationInteraction', 23) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(23)} lactationInteraction 🤱</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. CAUTION: Should be used with caution during breastfeeding..."
                                                                value={newItem.lactationInteraction || newItem.lactation_interaction}
                                                                onChange={e => setNewItem({ ...newItem, lactationInteraction: e.target.value, lactation_interaction: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #24 drivingInteraction */}
                                                    {matches('drivingInteraction', 24) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(24)} drivingInteraction 🚗</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. UNSAFE: May cause dizziness or drowsiness, avoid driving..."
                                                                value={newItem.drivingInteraction || newItem.driving_interaction}
                                                                onChange={e => setNewItem({ ...newItem, drivingInteraction: e.target.value, driving_interaction: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #25 kidneyInteraction */}
                                                    {matches('kidneyInteraction', 25) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(25)} kidneyInteraction 🩺</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. CAUTION: Should be used with caution in patients with severe kidney disease..."
                                                                value={newItem.kidneyInteraction || newItem.kidney_interaction}
                                                                onChange={e => setNewItem({ ...newItem, kidneyInteraction: e.target.value, kidney_interaction: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #26 liverInteraction */}
                                                    {matches('liverInteraction', 26) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(26)} liverInteraction 🫁</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. CAUTION: Should be used with caution in patients with liver disease..."
                                                                value={newItem.liverInteraction || newItem.liver_interaction}
                                                                onChange={e => setNewItem({ ...newItem, liverInteraction: e.target.value, liver_interaction: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #27 country_of_origin */}
                                                    {matches('country_of_origin', 27) && (
                                                        <div style={cardStyle}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(27)} country_of_origin</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. India"
                                                                value={newItem.country_of_origin}
                                                                onChange={e => setNewItem({ ...newItem, country_of_origin: e.target.value })}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #28 Q_A */}
                                                    {matches('Q_A', 28) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(28)} Q_A</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Questions & Answers</span>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', marginBottom: '8px', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Question e.g. Is it safe to take?"
                                                                    value={multiInputs.newQA.question}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newQA: { ...multiInputs.newQA, question: e.target.value } })}
                                                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Answer e.g. Yes, if taken in prescribed dose..."
                                                                    value={multiInputs.newQA.answer}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newQA: { ...multiInputs.newQA, answer: e.target.value } })}
                                                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }}
                                                                />
                                                                <button type="button" onClick={handleAddQA} style={{ padding: '6px 12px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 700, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add FAQ</button>
                                                            </div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="e.g. Q. Is it safe to take Acenac Tablet? A. Yes, Acenac Tablet is safe if taken in prescribed dose... | Q. Does Acenac Tablet get you high? A. No, it has no abuse potential..."
                                                                value={newItem.q_a}
                                                                onChange={e => setNewItem({ ...newItem, q_a: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #29 How it works */}
                                                    {matches('How it works', 29) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(29)} How it works</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Mechanism of Action</span>
                                                            </div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="e.g. Acenac Tablet is a non-steroidal anti-inflammatory drug (NSAID). It works by blocking the release of certain chemical messengers (prostaglandins) that cause pain and inflammation..."
                                                                value={newItem.how_it_works}
                                                                onChange={e => setNewItem({ ...newItem, how_it_works: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #30 drug-drug Interaction */}
                                                    {matches('drug-drug Interaction', 30) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(30)} drug-drug Interaction</span>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 2fr auto', gap: '8px', marginBottom: '8px', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Drug e.g. Tacrolimus"
                                                                    value={multiInputs.newDrug.drugName}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newDrug: { ...multiInputs.newDrug, drugName: e.target.value } })}
                                                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }}
                                                                />
                                                                <select
                                                                    value={multiInputs.newDrug.severity}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newDrug: { ...multiInputs.newDrug, severity: e.target.value } })}
                                                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                                                                >
                                                                    <option value="Severe">Severe</option>
                                                                    <option value="Moderate">Moderate</option>
                                                                    <option value="Mild">Mild</option>
                                                                    <option value="Caution">Caution</option>
                                                                </select>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Notes e.g. Monitor renal function closely"
                                                                    value={multiInputs.newDrug.details}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newDrug: { ...multiInputs.newDrug, details: e.target.value } })}
                                                                    style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }}
                                                                />
                                                                <button type="button" onClick={handleAddDrugInteraction} style={{ padding: '6px 12px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
                                                            </div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="e.g. -Tacrolimus (Oral Route): Severe <p> If concurrent use is essential, your doctor may monitor renal function... | -Methotrexate: Severe <p> ..."
                                                                value={newItem.drug_interactions}
                                                                onChange={e => setNewItem({ ...newItem, drug_interactions: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #31 Marketer details */}
                                                    {matches('Marketer details', 31) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(31)} Marketer details</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Company Address / Info</span>
                                                            </div>
                                                            <textarea
                                                                rows={2}
                                                                placeholder="e.g. Medley Pharmaceuticals Ltd, Medley House, D-2 M.I.D.C. Area, Andheri (East), Mumbai-400 093"
                                                                value={newItem.marketer_details}
                                                                onChange={e => setNewItem({ ...newItem, marketer_details: e.target.value })}
                                                                style={textareaStyle}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* #32 Image_Urls */}
                                                    {matches('Image_Urls', 32) && (
                                                        <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                                                            <div style={labelRowStyle}>
                                                                <span style={labelStyle}>{numBadge(32)} Image_Urls</span>
                                                                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>Multiple images supported with | or comma</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Paste image URL e.g. https://example.com/med_1.jpg"
                                                                    value={multiInputs.newImageUrl}
                                                                    onChange={e => setMultiInputs({ ...multiInputs, newImageUrl: e.target.value })}
                                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddImage(); } }}
                                                                    style={{ ...inputStyle, flex: 1 }}
                                                                />
                                                                <button type="button" onClick={handleAddImage} style={{ padding: '8px 16px', borderRadius: '8px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add Image</button>
                                                            </div>
                                                            {/* Thumbnails */}
                                                            {(() => {
                                                                const detected = extractImageUrls(newItem.image_urls);
                                                                if (!detected.length) return null;
                                                                return (
                                                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
                                                                        {detected.map((u, i) => (
                                                                            <div key={i} style={{ width: '60px', height: '60px', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                                                                <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                                                <button type="button" onClick={() => handleRemoveImage(i)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                            <textarea
                                                                rows={2}
                                                                placeholder="https://example.com/med_1.jpg | https://example.com/med_2.jpg"
                                                                value={newItem.image_urls}
                                                                onChange={e => setNewItem({ ...newItem, image_urls: e.target.value })}
                                                                style={{ ...textareaStyle, fontFamily: 'monospace', fontSize: '12px' }}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Sticky Footer with Save & Navigation */}
                            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {selectedCategory === 'medicine' && (
                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                            {Object.values(newItem).filter(v => Boolean(v) && v !== 'India').length} / 32 columns filled
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setIsAdding(false); setFormFieldSearch(''); }}
                                        style={{ padding: '10px 18px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        style={{ padding: '10px 22px', borderRadius: '8px', background: activeCat.color, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', boxShadow: `0 2px 6px ${activeCat.color}40` }}
                                    >
                                        {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />}
                                        <span>Save {activeCat.name.slice(0, -1)}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Comprehensive 32-Column Medicine Details Modal */}
            {viewingItem && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.7)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 1100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => setViewingItem(null)}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: '20px',
                            width: '100%',
                            maxWidth: '1120px',
                            maxHeight: '92vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 60px -15px rgba(15,23,42,0.4)',
                            overflow: 'hidden'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', flexShrink: 0, border: '1.5px solid #c7d2fe' }}>
                                    <Pill size={26} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                            {viewingItem.name}
                                        </h2>
                                        {(viewingItem.product_id || viewingItem.code) && (
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', border: '1px solid #c7d2fe' }}>
                                                {viewingItem.product_id || viewingItem.code}
                                            </span>
                                        )}
                                        {viewingItem.mrp != null && (
                                            <span style={{ fontWeight: 800, fontSize: '13px', background: '#ecfdf5', color: '#047857', padding: '2px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                                                ₹{viewingItem.mrp}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: viewingItem.prescription_required !== false ? '#fee2e2' : '#f0fdf4', color: viewingItem.prescription_required !== false ? '#dc2626' : '#16a34a', border: `1px solid ${viewingItem.prescription_required !== false ? '#fecaca' : '#bbf7d0'}` }}>
                                            {viewingItem.prescription_required !== false ? 'Rx Required' : 'OTC'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                                        {(viewingItem.marketing_company || viewingItem.marketer) && (
                                            <span>🏢 <strong>Marketer:</strong> {viewingItem.marketing_company || viewingItem.marketer}</span>
                                        )}
                                        {viewingItem.product_form && (
                                            <span>💊 <strong>Form:</strong> {viewingItem.product_form}</span>
                                        )}
                                        {viewingItem.package && (
                                            <span>📦 <strong>Package:</strong> {viewingItem.package} {viewingItem.qty ? `(${viewingItem.qty})` : ''}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setViewingItem(null)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, background: '#ffffff' }}>

                            {/* Section: Composition & Primary Use */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        🧪 Active Composition / Salts
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                        {viewingItem.composition || viewingItem.key_ingredients || '-'}
                                    </div>
                                </div>

                                <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '14px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        🎯 Primary Use / Indications
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {parsePrimaryUse(viewingItem.primary_use).length > 0 ? (
                                            parsePrimaryUse(viewingItem.primary_use).map((u, idx) => (
                                                <span key={idx} style={{ fontSize: '12px', background: '#fff', color: '#0369a1', border: '1px solid #7dd3fc', padding: '3px 10px', borderRadius: '8px', fontWeight: 700 }}>
                                                    {u}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '13px', color: '#64748b' }}>{viewingItem.primary_use || '-'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section: Description, Benefits & How to use */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                                {(viewingItem.introduction || viewingItem.information) && (
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            📖 Introduction / Information
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
                                            {viewingItem.introduction || viewingItem.information}
                                        </p>
                                    </div>
                                )}

                                {(viewingItem.benefits || viewingItem.key_benefits) && (
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            ✨ Key Benefits
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#166534', lineHeight: '1.5', margin: 0 }}>
                                            {viewingItem.benefits || viewingItem.key_benefits}
                                        </p>
                                    </div>
                                )}

                                {(viewingItem.how_to_use || viewingItem.directions_for_use) && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            📋 Directions for Use / How to Use
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.5', margin: 0 }}>
                                            {viewingItem.how_to_use || viewingItem.directions_for_use}
                                        </p>
                                        {viewingItem.if_miss && (
                                            <p style={{ fontSize: '12px', color: '#92400e', marginTop: '8px', borderTop: '1px dashed #fcd34d', paddingTop: '8px', margin: '8px 0 0' }}>
                                                <strong>If Missed:</strong> {viewingItem.if_miss}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section: How it works (Mechanism of Action) */}
                            {viewingItem.how_it_works && (
                                <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '16px' }}>⚙️</span>
                                        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                            How It Works (Mechanism of Action)
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {parseHowItWorks(viewingItem.how_it_works).map((pt, idx) => (
                                            <div key={idx} style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#3b0764', lineHeight: '1.5', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ede9fe', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0, marginTop: '1px' }}>
                                                    {idx + 1}
                                                </span>
                                                <span>{pt}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section: Q_A (Frequently Asked Questions) */}
                            {viewingItem.q_a && (
                                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '16px' }}>❓</span>
                                        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                            Questions & Answers ({parseQA(viewingItem.q_a).length})
                                        </h3>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                                        {parseQA(viewingItem.q_a).map((item, idx) => (
                                            <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4338ca', lineHeight: '1.4' }}>
                                                    <span style={{ background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px', marginRight: '6px', fontSize: '11px', fontWeight: 800 }}>Q{idx + 1}</span>
                                                    {item.question}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5', paddingLeft: '4px' }}>
                                                    <span style={{ color: '#059669', fontWeight: 800, marginRight: '4px' }}>A:</span>
                                                    {item.answer}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section: Drug-Drug Interactions */}
                            {viewingItem.drug_interactions && (
                                <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <AlertCircle size={18} color="#e11d48" />
                                        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                            Drug-Drug Interactions ({parseDrugInteractions(viewingItem.drug_interactions).length})
                                        </h3>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                                        {parseDrugInteractions(viewingItem.drug_interactions).map((d, idx) => {
                                            const sev = getSeverityBadgeStyle(d.severity);
                                            return (
                                                <div key={idx} style={{ background: '#fff', border: `1.5px solid ${sev.border}`, borderRadius: '10px', padding: '12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{d.drugName}</span>
                                                        {d.severity && (
                                                            <span style={{ fontSize: '10px', fontWeight: 800, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, padding: '2px 8px', borderRadius: '4px' }}>
                                                                {d.severity}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {d.details && (
                                                        <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4', margin: 0 }}>{d.details}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Section: Safety Advisories (6 Categories) */}
                            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                    🛡️ Safety Advisories & Interactions
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                    {[
                                        { label: 'Alcohol', icon: '🍷', val: viewingItem.alcohol_interaction || viewingItem.alcoholInteraction },
                                        { label: 'Pregnancy', icon: '🤰', val: viewingItem.pregnancy_interaction || viewingItem.pregnancyInteraction },
                                        { label: 'Breast feeding / Lactation', icon: '🤱', val: viewingItem.lactation_interaction || viewingItem.lactationInteraction },
                                        { label: 'Driving', icon: '🚗', val: viewingItem.driving_interaction || viewingItem.drivingInteraction },
                                        { label: 'Kidney', icon: '🩺', val: viewingItem.kidney_interaction || viewingItem.kidneyInteraction },
                                        { label: 'Liver', icon: '🫁', val: viewingItem.liver_interaction || viewingItem.liverInteraction },
                                    ].map(({ label, icon, val }) => (
                                        <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#1e293b', marginBottom: '4px' }}>
                                                <span>{icon}</span>
                                                <span>{label}</span>
                                            </div>
                                            <div style={{ fontSize: '12px' }}>
                                                {renderSafetyCell(val)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section: Classification (Fact Box) & Side Effects */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                                {viewingItem.fact_box && (
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            🏷️ Pharmaceutical Classification (Fact Box)
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {parseFactBox(viewingItem.fact_box).map((f, idx) => (
                                                <span key={idx} style={{ fontSize: '11px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                    <span style={{ color: '#64748b' }}>{f.label}:</span> <strong>{f.value}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(viewingItem.side_effects || viewingItem.side_effect) && (
                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            ⚠️ Side Effects / Adverse Reactions
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {parseSideEffects(viewingItem.side_effects || viewingItem.side_effect).map((s, idx) => (
                                                <span key={idx} style={{ fontSize: '11px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section: Image Gallery */}
                            {extractImageUrls(viewingItem).length > 0 && (
                                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <ImageIcon size={18} color="#4f46e5" />
                                        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                            Product Images ({extractImageUrls(viewingItem).length})
                                        </h3>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                                        {extractImageUrls(viewingItem).map((url, idx) => (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '8px', textAlign: 'center', textDecoration: 'none', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Img ${idx + 1}`}
                                                    referrerPolicy="no-referrer"
                                                    style={{ width: '100%', height: '110px', objectFit: 'contain', borderRadius: '6px' }}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                                    }}
                                                />
                                                <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    Image #{idx + 1} <ExternalLink size={11} />
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section: Logistics & Packaging Details */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: '#fafafa', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>STORAGE:</span>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{viewingItem.storage || '-'}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>PACKAGING DETAIL:</span>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{viewingItem.packaging_detail || viewingItem.packaging || '-'}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>COUNTRY OF ORIGIN:</span>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{viewingItem.country_of_origin || 'India'}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>MARKETER DETAILS:</span>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{viewingItem.marketer_details || '-'}</div>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button
                                onClick={() => setViewingItem(null)}
                                style={{ padding: '10px 24px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Toast */}
            {status.message && (
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '12px 24px', borderRadius: '10px', background: status.type === 'success' ? '#059669' : '#dc2626', color: '#fff', fontWeight: 600, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 10000, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span>{status.message}</span>
                </div>
            )}

            <style>{`
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ClinicalMasterManagement;
