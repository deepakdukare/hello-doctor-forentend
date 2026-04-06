import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Users, 
    Plus, 
    Search, 
    Phone, 
    Mail, 
    MapPin, 
    Stethoscope,
    TrendingUp,
    MoreVertical,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Download
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';

const ReferringDoctors = () => {
    const [doctors, setDoctors] = useState([]);
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newDoctor, setNewDoctor] = useState({
        name: '',
        specialization: '',
        clinic_name: '',
        phone: '',
        email: '',
        address: ''
    });

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [docsRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/referring-doctors?all=true`),
                axios.get(`${API_BASE_URL}/analytics/referrers`)
            ]);
            setDoctors(docsRes.data.data);
            setStats(statsRes.data.data);
        } catch (err) {
            console.error('Error fetching referring doctors:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDoctor = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE_URL}/referring-doctors`, newDoctor);
            setShowAddModal(false);
            setNewDoctor({ name: '', specialization: '', clinic_name: '', phone: '', email: '', address: '' });
            fetchData();
        } catch (err) {
            alert('Error adding doctor: ' + (err.response?.data?.message || err.message));
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            await axios.patch(`${API_BASE_URL}/referring-doctors/${id}`, { is_active: !currentStatus });
            fetchData();
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

    const filteredDoctors = doctors.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.clinic_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Referring Doctor Registry</h1>
                    <p className="text-slate-500">Manage and analyze external medical referrals</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add New Referral
                    </button>
                    <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                        <Download size={18} />
                        Export Data
                    </button>
                </div>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-indigo-600" />
                            Top Referring Doctors
                        </h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={120} 
                                    tick={{ fill: '#64748b', fontSize: 12 }} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                                    {stats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-xl text-white shadow-lg flex flex-col justify-between">
                    <div>
                        <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                            <Users size={24} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Network Growth</h3>
                        <p className="text-indigo-100 text-sm">Your referral network has grown by 12% this month.</p>
                    </div>
                    <div className="mt-8">
                        <div className="text-4xl font-bold">{doctors.length}</div>
                        <div className="text-indigo-200 text-sm">Active Partners</div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex justify-between items-center text-sm">
                            <span>High Volume (50+)</span>
                            <span className="font-semibold">4 Doctors</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by name, specialization, or clinic..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-left">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Doctor Info</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Specialization</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredDoctors.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">No doctors found matching your search.</td>
                                </tr>
                            ) : (
                                filteredDoctors.map((doc) => (
                                    <tr key={doc.doctor_id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                                                    {doc.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900">{doc.name}</div>
                                                    <div className="text-xs text-slate-500">{doc.clinic_name || 'Private Clinic'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                {doc.specialization || 'General Practitioner'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Phone size={14} className="text-slate-400" />
                                                    {doc.phone || 'N/A'}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Mail size={14} className="text-slate-400" />
                                                    {doc.email || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => toggleStatus(doc.doctor_id, doc.is_active)}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                                    doc.is_active 
                                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                }`}
                                            >
                                                {doc.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                {doc.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800">Add Referring Doctor</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XCircle size={24} className="text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Doctor's Full Name *</label>
                                    <input 
                                        required
                                        type="text" 
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Dr. Rajesh Kumar"
                                        value={newDoctor.name}
                                        onChange={(e) => setNewDoctor({...newDoctor, name: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
                                        <input 
                                            type="text" 
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Pediatrician"
                                            value={newDoctor.specialization}
                                            onChange={(e) => setNewDoctor({...newDoctor, specialization: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Clinic Name</label>
                                        <input 
                                            type="text" 
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Health First Clinic"
                                            value={newDoctor.clinic_name}
                                            onChange={(e) => setNewDoctor({...newDoctor, clinic_name: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                        <input 
                                            type="tel" 
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="+91 98765 43210"
                                            value={newDoctor.phone}
                                            onChange={(e) => setNewDoctor({...newDoctor, phone: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                        <input 
                                            type="email" 
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="rajesh@example.com"
                                            value={newDoctor.email}
                                            onChange={(e) => setNewDoctor({...newDoctor, email: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                    <textarea 
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="123, MG Road, Mumbai..."
                                        rows="2"
                                        value={newDoctor.address}
                                        onChange={(e) => setNewDoctor({...newDoctor, address: e.target.value})}
                                    ></textarea>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                                >
                                    Save Partner
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReferringDoctors;
