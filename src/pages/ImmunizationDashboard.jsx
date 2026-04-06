import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Syringe, 
    Calendar, 
    AlertCircle, 
    TrendingUp, 
    PieChart, 
    Bell, 
    ArrowRight,
    Users,
    Zap,
    History,
    CheckCircle2,
    Clock,
    FileText,
    Activity
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, AreaChart, Area
} from 'recharts';

const ImmunizationDashboard = () => {
    const [data, setData] = useState({
        top_vaccines: [],
        upcoming_doses: [],
        total_vaccinations: 0
    });
    const [loading, setLoading] = useState(true);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

    useEffect(() => {
        const fetchVaccineData = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/analytics/vaccines`);
                setData(res.data.data);
            } catch (err) {
                console.error('Error fetching vaccine data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchVaccineData();
    }, []);

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Zap className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg text-white">
                            <Syringe size={24} />
                        </div>
                        Immunization Intelligence Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1">Real-time vaccination analytics & dose tracking</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Activity size={14} /> LIVE ANALYTICS
                    </span>
                    <button className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all flex items-center gap-2">
                        <Calendar size={18} /> Schedule Camp
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-emerald-500 text-xs font-bold">+12.5%</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{data.total_vaccinations.toLocaleString()}</div>
                    <div className="text-sm text-slate-500 mt-1">Total Doses Administered</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-medium">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
                            <Clock size={20} />
                        </div>
                        <span className="text-amber-500 text-xs font-bold">Priority</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{data.upcoming_doses.length}</div>
                    <div className="text-sm text-slate-500 mt-1">Doses Due This Week</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
                            <Users size={20} />
                        </div>
                        <span className="text-emerald-500 text-xs font-bold">98%</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">128</div>
                    <div className="text-sm text-slate-500 mt-1">Active Infants Tracked</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-rose-50 p-2 rounded-xl text-rose-600">
                            <AlertCircle size={20} />
                        </div>
                        <span className="text-rose-500 text-xs font-bold">Action Needed</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">15</div>
                    <div className="text-sm text-slate-500 mt-1">Drop-off Alerts (Overdue)</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Vaccine Inventory Planning Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Vaccine Demand Analysis</h3>
                            <p className="text-slate-500 text-sm">Most frequently administered vaccines this month</p>
                        </div>
                        <div className="bg-slate-100 p-1.5 rounded-lg flex gap-1">
                            <button className="px-3 py-1 rounded-md bg-white text-slate-700 font-semibold shadow-sm text-xs transition-all">Bar</button>
                            <button className="px-3 py-1 rounded-md text-slate-500 text-xs font-semibold hover:text-slate-700 transition-all">Line</button>
                        </div>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.top_vaccines}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="_id" 
                                    tick={{ fill: '#64748b', fontSize: 13 }} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{ fill: '#64748b', fontSize: 13 }} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={45}>
                                    {data.top_vaccines.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Overdue/Drop-off tracking */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                        <AlertCircle size={20} className="text-rose-500" />
                        Drop-off Tracking
                    </h3>
                    <p className="text-slate-500 text-sm mb-6 text-balance">Patients overdue for their next dose based on clinical rules.</p>
                    
                    <div className="space-y-4 flex-1 overflow-y-auto">
                        {data.upcoming_doses.length === 0 ? (
                             <div className="text-center py-10">
                                <div className="bg-emerald-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle2 className="text-emerald-500" size={24} />
                                </div>
                                <p className="text-slate-400 text-sm">No drop-offs detected for this period.</p>
                             </div>
                        ) : (
                            data.upcoming_doses.slice(0, 5).map((dose, idx) => (
                                <div key={idx} className="group p-4 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-slate-800 text-sm">{dose.child_name || 'Baby Patient'}</span>
                                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase">Overdue</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <Shield size={12} className="text-slate-400" /> {dose.vaccine_expected || 'Pending Booster'}
                                        <span className="text-slate-300">•</span>
                                        <Clock size={12} className="text-slate-400" /> {new Date(dose.next_due_date).toLocaleDateString()}
                                    </div>
                                    <button className="mt-3 w-full opacity-0 group-hover:opacity-100 transition-all bg-white text-indigo-600 border border-indigo-200 font-bold py-1.5 rounded-lg text-xs shadow-sm hover:bg-indigo-600 hover:text-white flex items-center justify-center gap-2">
                                        <Bell size={12} /> Send WhatsApp Alert
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Upcoming Dose Alerts Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Upcoming Vaccination Appointments</h3>
                        <p className="text-slate-500 text-sm">Automated alerts for the next 7 days</p>
                    </div>
                    <button className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline">
                        View All Calendar <ArrowRight size={16} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-6 py-4">Patient</th>
                                <th className="px-6 py-4">Expected Vaccine</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4">Eligibility</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {data.upcoming_doses.map((dose, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{dose.child_name}</div>
                                        <div className="text-xs text-slate-500">PID: {dose.patient_id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{dose.vaccine_expected || 'Generic Booster'}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{new Date(dose.next_due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                                            <CheckCircle2 size={14} /> Ready for Dose
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-md hover:bg-indigo-700 transition-all">Prepare Dose</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Mock Shield icon since lucide-react might have slightly different names for some shapes
const Shield = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
);

export default ImmunizationDashboard;
