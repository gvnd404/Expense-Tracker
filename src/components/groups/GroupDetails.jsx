import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, onSnapshot, deleteDoc, arrayRemove } from 'firebase/firestore';
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
    const [editingExpense, setEditingExpense] = useState(null);

    // For delete confirmation or formatting
    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

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

    const handleRemoveMember = async (member) => {
        if (window.confirm(`Are you sure you want to remove ${member.name}?`)) {
            try {
                const groupRef = doc(db, "groups", groupId);
                await updateDoc(groupRef, { participantsList: arrayRemove(member) });
                setGroup(prev => ({
                    ...prev,
                    participantsList: prev.participantsList.filter(p => p.id !== member.id)
                }));
            } catch (error) {
                console.error("Error removing member:", error);
                alert("Failed to remove member. They might be involved in expenses.");
            }
        }
    };

    const handleDeleteExpense = async (e, expenseId) => {
        e.stopPropagation();
        if (window.confirm("Delete this expense?")) {
            try {
                await deleteDoc(doc(db, "expenses", expenseId));
            } catch (error) {
                console.error("Error deleting expense:", error);
            }
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-teal-600 font-medium">Loading...</div>;
    if (!group) return null;

    const participants = group.participantsList || [];
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const perPersonShare = participants.length > 0 ? (totalSpent / participants.length) : 0;

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans pb-20">
            {/* Header / Top Bar */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 transition hover:text-gray-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{group.name}</h1>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">{participants.length} members</span>
                                <span>•</span>
                                <span>{expenses.length} expenses</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold cursor-help" title="Average share per person">Per Person</span>
                            <span className="text-xl font-bold text-gray-500">₹{perPersonShare.toFixed(2)}</span>
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Total Spent</span>
                            <span className="text-2xl font-bold text-teal-600">₹{totalSpent.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8">

                {/* Top Section: Participants & Quick Add */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <section className="col-span-1 lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <span className="p-1.5 bg-teal-100 text-teal-600 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </span>
                                Participants
                            </h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {participants.map(member => (
                                <div key={member.id} className="group relative flex items-center gap-2 pl-2 pr-4 py-1.5 bg-gray-50 rounded-full border border-gray-100 hover:border-red-200 transition">
                                    <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{member.name}</span>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => handleRemoveMember(member)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm scale-90 hover:scale-110"
                                        title="Remove member"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}

                            <form onSubmit={handleAddMember} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newMemberName}
                                    onChange={(e) => setNewMemberName(e.target.value)}
                                    placeholder="+ Add..."
                                    className="w-24 px-3 py-2 bg-white border-b-2 border-gray-200 focus:border-teal-500 outline-none text-sm transition"
                                />
                                <button type="submit" disabled={!newMemberName.trim()} className="text-teal-600 hover:text-teal-700 disabled:opacity-30">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                </button>
                            </form>
                        </div>
                    </section>

                    <section className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 shadow-lg text-white flex flex-col justify-between relative overflow-hidden group cursor-pointer"
                        onClick={() => setShowAddExpense(true)}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 transition group-hover:scale-110"></div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Add Expense</h2>
                            <p className="text-teal-100 text-sm">Split bills instantly</p>
                        </div>
                        <div className="mt-4 self-end bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        </div>
                    </section>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Activity Feed */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </span>
                                Expenses
                            </h2>

                            {/* Add Expense Form (Inline) */}
                            {showAddExpense && (
                                <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-200 animate-slide-down">
                                    <AddExpense
                                        groupId={groupId}
                                        participants={participants}
                                        onClose={() => setShowAddExpense(false)}
                                        onExpenseAdded={() => {/* Realtime update handles it */ }}
                                        isInline={true}
                                    />
                                    <div className="mt-4 text-center">
                                        <button onClick={() => setShowAddExpense(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Edit Expense Modal */}
                            {editingExpense && (
                                <AddExpense
                                    groupId={groupId}
                                    participants={participants}
                                    initialData={editingExpense}
                                    onClose={() => setEditingExpense(null)}
                                    onExpenseAdded={() => setEditingExpense(null)}
                                    isInline={true} // Triggers modal wrapper in component
                                />
                            )}

                            <div className="space-y-4">
                                {expenses.length === 0 ? (
                                    <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                        </div>
                                        <p className="text-gray-400 font-medium">No expenses yet. Add one to get started!</p>
                                    </div>
                                ) : (
                                    expenses.map(exp => (
                                        <div key={exp.id}
                                            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 hover:bg-gray-50 rounded-2xl border border-gray-100 border-l-4 border-l-transparent hover:border-l-teal-500 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer gap-4 sm:gap-0"
                                            onClick={() => setEditingExpense(exp)}
                                        >
                                            <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
                                                <div className="flex flex-col items-center bg-gray-100 rounded-lg p-2 min-w-[50px] sm:min-w-[60px]">
                                                    <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase">{formatDate(exp.date).split(' ')[0]}</span>
                                                    <span className="text-lg sm:text-xl font-bold text-gray-800">{formatDate(exp.date).split(' ')[1]}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1 flex items-center gap-2 truncate">
                                                        <span className="truncate">{exp.description}</span>
                                                        <span className="opacity-0 group-hover:opacity-100 text-teal-400 hidden sm:inline">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </span>
                                                    </h3>
                                                    <div className="text-sm text-gray-500 flex flex-col gap-0.5">
                                                        <span className="flex items-center gap-1">
                                                            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            {Object.keys(exp.paidBy).length > 1
                                                                ? <span className="font-medium text-gray-700 text-xs sm:text-sm">{Object.keys(exp.paidBy).length} people paid</span>
                                                                : <span className="font-medium text-gray-700 text-xs sm:text-sm">{participants.find(p => p.id === Object.keys(exp.paidBy)[0])?.name || 'Unknown'} paid</span>
                                                            }
                                                        </span>
                                                        <span className="text-[10px] sm:text-xs text-gray-400 truncate">
                                                            For {Object.keys(exp.splitBetween).length === participants.length ? 'Everyone' : `${Object.keys(exp.splitBetween).length} involved`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-4">
                                                <div className="text-left sm:text-right">
                                                    <span className="block text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">₹{exp.amount.toFixed(2)}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteExpense(e, exp.id)}
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition sm:opacity-0 sm:group-hover:opacity-100"
                                                    title="Delete Expense"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar: Balances */}
                    <div className="space-y-6">
                        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 sticky top-24">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                                </span>
                                <h2 className="text-lg font-bold text-gray-800">Balances</h2>
                            </div>

                            <BalanceView expenses={expenses} participants={participants} />
                        </section>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default GroupDetails;
