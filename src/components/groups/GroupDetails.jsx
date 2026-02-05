import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import AddExpense from '../expenses/AddExpense';
import BalanceView from '../settlement/BalanceView';

const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState([]);

    // UI State
    const [newMemberName, setNewMemberName] = useState('');
    const [showAddExpense, setShowAddExpense] = useState(false);

    // Initial Fetch
    useEffect(() => {
        const fetchGroup = async () => {
            if (!groupId) return;
            try {
                const docRef = doc(db, "groups", groupId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setGroup({ id: docSnap.id, ...docSnap.data() });
                } else {
                    navigate('/');
                }
            } catch (error) {
                console.error("Error fetching group:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGroup();
    }, [groupId, navigate]);

    // Real-time Expenses
    useEffect(() => {
        if (!groupId) return;
        const q = query(collection(db, "expenses"), where("groupId", "==", groupId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Client-side sort (Newest first)
            expensesData.sort((a, b) => {
                const dA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const dB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return dB - dA;
            });
            setExpenses(expensesData);
        });
        return () => unsubscribe();
    }, [groupId]);

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!newMemberName.trim()) return;
        try {
            const newMember = {
                id: crypto.randomUUID(),
                name: newMemberName,
                isGuest: true,
                addedBy: currentUser.uid
            };
            const groupRef = doc(db, "groups", groupId);
            await updateDoc(groupRef, { participantsList: arrayUnion(newMember) });
            setGroup(prev => ({ ...prev, participantsList: [...(prev.participantsList || []), newMember] }));
            setNewMemberName('');
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-teal-600 font-medium">Loading...</div>;
    if (!group) return null;

    const participants = group.participantsList || [];
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans pb-20">
            {/* Header / Top Bar */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
                            <p className="text-xs text-gray-500">{participants.length} people • {expenses.length} expenses</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Total Spent</p>
                        <p className="text-lg font-bold text-teal-600">₹{totalSpent.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Input Operations */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Participants Card */}
                    <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="text-teal-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </span>
                            Participants
                        </h2>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {participants.map(member => (
                                <span key={member.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                    {member.name}
                                </span>
                            ))}
                        </div>

                        <form onSubmit={handleAddMember} className="flex gap-2">
                            <input
                                type="text"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                placeholder="Add participant..."
                                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                            />
                            <button type="submit" disabled={!newMemberName.trim()} className="bg-teal-100 hover:bg-teal-200 text-teal-700 p-3 rounded-xl transition disabled:opacity-50">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </form>
                    </section>

                    {/* Add Expense Trigger Card */}
                    <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <span className="text-teal-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </span>
                                Add Expense
                            </h2>
                        </div>

                        {/* Inline Simplified Trigger or Full Form Modal Trigger */}
                        {!showAddExpense ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <button
                                    onClick={() => setShowAddExpense(true)}
                                    className="col-span-4 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-medium hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50/50 transition flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    Add New Expense
                                </button>
                            </div>
                        ) : (
                            <div className="animate-fade-in-up">
                                <AddExpense
                                    groupId={groupId}
                                    participants={participants}
                                    onClose={() => setShowAddExpense(false)}
                                    onExpenseAdded={() => {/* Snapshot handles update */ }}
                                    isInline={true} // Hint to remove modal overlay styles
                                />
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: Balances & History */}
                <div className="space-y-8">
                    {/* Balances Card */}
                    <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-emerald-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 3.666V14h-6v-3.334H5V5h14v5.666h-2M9 7v2m0 0h6m-6 0V7m6 0v2m-6 8h6m-3-3v3m-3-6h6m-6 0V7m0 2h6m0-2v2" /></svg>
                            </span>
                            <h2 className="text-lg font-bold text-gray-800">Balances</h2>
                        </div>

                        <BalanceView expenses={expenses} participants={participants} />
                    </section>

                    {/* Recent Activity Mini List */}
                    <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">History</h2>
                        <div className="space-y-4">
                            {expenses.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No activity yet.</p>
                            ) : (
                                expenses.slice(0, 5).map(exp => ( // Show only top 5 recent
                                    <div key={exp.id} className="flex justify-between items-center pb-4 border-b border-gray-50 last:border-0 last:pb-0 hover:bg-gray-50/50 p-2 rounded-lg transition -mx-2">
                                        <div>
                                            <p className="text-base font-bold text-gray-800 mb-1">{exp.description}</p>
                                            <p className="text-xs text-gray-400 font-medium">
                                                {exp.date?.toDate ? new Date(exp.date.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : new Date(exp.date).toLocaleDateString()}
                                                <span className="mx-1">•</span>
                                                <span className="text-gray-500">
                                                    {Object.keys(exp.paidBy).length > 1 ? `Paid by ${Object.keys(exp.paidBy).length} people` : `Paid by ${participants.find(p => p.id === Object.keys(exp.paidBy)[0])?.name || 'Unknown'}`}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-bold text-gray-900 block">₹{exp.amount.toFixed(2)}</span>
                                            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                                                {Object.keys(exp.splitBetween).length === participants.length ? 'Shared by all' : `${Object.keys(exp.splitBetween).length} involved`}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                            {expenses.length > 5 && (
                                <button className="w-full text-center text-xs text-teal-600 font-bold hover:underline py-2">View All Activity</button>
                            )}
                        </div>
                    </section>
                </div>

            </main>
        </div>
    );
};

export default GroupDetails;
