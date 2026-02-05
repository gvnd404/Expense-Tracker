import React, { useMemo } from 'react';
import { calculateBalances, calculateSettlements } from '../../lib/algorithms';

const BalanceView = ({ expenses, participants }) => {
    const { balances, settlements } = useMemo(() => {
        const balances = calculateBalances(expenses, participants);
        const settlements = calculateSettlements(balances);
        return { balances, settlements };
    }, [expenses, participants]);

    const getParticipantName = (id) => {
        const p = participants.find(m => m.id === id);
        return p ? p.name : "Unknown";
    };

    if (expenses.length === 0) return <p className="text-sm text-gray-400 italic">No balances yet.</p>;

    return (
        <div className="space-y-6">
            {/* Net Balances List */}
            <div className="space-y-3">
                {participants.map(p => {
                    const bal = balances[p.id] || 0;
                    if (Math.abs(bal) < 0.01) return null;

                    const isOwed = bal > 0;
                    return (
                        <div key={p.id} className={`flex justify-between items-center p-3 rounded-2xl ${isOwed ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOwed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {isOwed
                                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /> // Arrow Down (Receiving)
                                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /> // Arrow Up (Paying)
                                        }
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-700">{p.name}</p>
                                    <p className={`text-xs ${isOwed ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {isOwed ? "gets back" : "owes"}
                                    </p>
                                </div>
                            </div>
                            <span className={`font-bold ${isOwed ? 'text-emerald-600' : 'text-red-500'}`}>
                                {isOwed ? '+' : ''}₹{Math.abs(bal).toFixed(2)}
                            </span>
                        </div>
                    );
                })}
                {Object.values(balances).every(b => Math.abs(b) < 0.01) && (
                    <div className="text-center py-4 bg-gray-50 rounded-2xl">
                        <span className="text-gray-400 text-sm">Everyone is settled up!</span>
                    </div>
                )}
            </div>

            {/* Settlement Plan Button/Section */}
            {settlements.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-4 text-white shadow-lg">
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Settlement Plan
                        </h3>
                        <div className="space-y-2">
                            {settlements.map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{getParticipantName(s.from)}</span>
                                        <span className="opacity-70 text-xs">pays</span>
                                        <span className="font-semibold">{getParticipantName(s.to)}</span>
                                    </div>
                                    <span className="font-bold">₹{s.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BalanceView;
