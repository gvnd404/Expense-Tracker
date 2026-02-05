import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { calculateEqualSplit } from '../../lib/algorithms';

const AddExpense = ({ groupId, participants, onClose, onExpenseAdded, isInline = false, initialData = null }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Payer Mode: 'single' | 'multiple'
    const [payerMode, setPayerMode] = useState('single');
    const [payerId, setPayerId] = useState('');
    const [multiPayers, setMultiPayers] = useState({}); // { userId: amount }

    const [consumerIds, setConsumerIds] = useState([]);

    // Initialize state
    useEffect(() => {
        if (participants.length > 0) {
            // Default Init
            setPayerId(participants[0].id);
            setConsumerIds(participants.map(p => p.id));
            const initialMulti = {};
            participants.forEach(p => initialMulti[p.id] = '');
            setMultiPayers(initialMulti);

            // Edit Mode Overwrite
            if (initialData) {
                setDescription(initialData.description);
                setAmount(initialData.amount);

                // Handle Date (Firestore Timestamp or String)
                if (initialData.date) {
                    const d = initialData.date.toDate ? initialData.date.toDate() : new Date(initialData.date);
                    setDate(d.toISOString().split('T')[0]);
                }

                // Handle Payers
                const paidByIds = Object.keys(initialData.paidBy || {});
                if (paidByIds.length > 1) {
                    setPayerMode('multiple');
                    const newMulti = {};
                    participants.forEach(p => newMulti[p.id] = initialData.paidBy[p.id] || '');
                    setMultiPayers(newMulti);
                } else if (paidByIds.length === 1) {
                    setPayerMode('single');
                    setPayerId(paidByIds[0]);
                }

                // Handle Consumers
                // If everyone was split, splitBetween might not explicitly list everyone if logic differs, 
                // but our algorithm saves explicit list usually? 
                // Wait, our algorithm saves `splitBetween` map {id: amount}. 
                // `consumptions` array is what we save alongside for easy consumption tracking?
                // Looking at previous AddExpense, we saved `consumptions: consumerIds`.
                if (initialData.consumptions) {
                    setConsumerIds(initialData.consumptions);
                } else if (initialData.splitBetween) {
                    setConsumerIds(Object.keys(initialData.splitBetween));
                }
            }
        }
    }, [participants, initialData]);

    const handleMultiPayerChange = (userId, value) => {
        setMultiPayers(prev => ({
            ...prev,
            [userId]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const totalAmount = parseFloat(amount);
        if (!description || isNaN(totalAmount) || totalAmount <= 0) {
            alert("Please enter valid description and amount");
            return;
        }

        let paidBy = {};
        if (payerMode === 'single') {
            paidBy = { [payerId]: totalAmount };
        } else {
            // Validate multi-payer total
            const multiTotal = Object.values(multiPayers).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
            if (Math.abs(multiTotal - totalAmount) > 0.01) {
                alert(`Total paid amounts (₹${multiTotal.toFixed(2)}) must equal expense amount (₹${totalAmount})`);
                return;
            }

            // Construct paidBy object for only those who paid > 0
            Object.entries(multiPayers).forEach(([uid, val]) => {
                const valFloat = parseFloat(val);
                if (valFloat > 0) {
                    paidBy[uid] = valFloat;
                }
            });
        }

        const splitMap = calculateEqualSplit(totalAmount, consumerIds);

        try {
            const expenseData = {
                groupId,
                description,
                amount: totalAmount,
                date: new Date(date),
                paidBy,
                splitBetween: splitMap,
                consumptions: consumerIds,
                updatedAt: serverTimestamp()
            };

            if (initialData && initialData.id) {
                // Update
                await updateDoc(doc(db, "expenses", initialData.id), expenseData);
            } else {
                // Create
                expenseData.createdAt = serverTimestamp();
                await addDoc(collection(db, "expenses"), expenseData);
            }

            onExpenseAdded();
            if (!isInline) onClose();
            else if (!initialData) {
                // Only clear if adding new, not if editing (user might want to see what they saved or modal closes)
                // Actually if inline editing, we usually close the edit form.
                setDescription('');
                setAmount('');
                setMultiPayers(Object.fromEntries(participants.map(p => [p.id, ''])));
            }
        } catch (error) {
            console.error("Error saving expense:", error);
            alert("Failed to save expense");
        }
    };

    const toggleConsumer = (id) => {
        setConsumerIds(prev => {
            if (prev.includes(id)) {
                if (prev.length === 1) return prev;
                return prev.filter(p => p !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const content = (
        <div className={`bg-white ${(!isInline || initialData) ? 'rounded-2xl shadow-xl max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto' : ''}`}>
            {(!isInline || initialData) && (
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">{initialData ? 'Edit Expense' : 'Add New Expense'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Description */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. Dinner"
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition font-medium"
                        required
                    />
                </div>

                {/* Amount & Date */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3 text-gray-500 font-medium">₹</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                className="w-full pl-8 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition font-bold text-gray-800"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition text-gray-600 font-medium"
                        />
                    </div>
                </div>

                {/* Paid By Section */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Paid By</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                type="button"
                                onClick={() => setPayerMode('single')}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${payerMode === 'single' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                Single
                            </button>
                            <button
                                type="button"
                                onClick={() => setPayerMode('multiple')}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${payerMode === 'multiple' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                Multiple
                            </button>
                        </div>
                    </div>

                    {payerMode === 'single' ? (
                        <div className="relative">
                            <select
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition text-gray-700 appearance-none font-medium cursor-pointer"
                            >
                                {participants.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-3.5 pointer-events-none text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {participants.map(p => (
                                <div key={p.id} className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-gray-700 w-24 truncate" title={p.name}>{p.name}</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1.5 text-gray-400 text-xs">₹</span>
                                        <input
                                            type="number"
                                            value={multiPayers[p.id]}
                                            onChange={(e) => handleMultiPayerChange(p.id, e.target.value)}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                            className="w-full pl-6 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 outline-none"
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="text-right text-xs pt-1 border-t border-gray-200 mt-2">
                                <span className={Math.abs(Object.values(multiPayers).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) - parseFloat(amount || 0)) > 0.01 ? "text-red-500 font-bold" : "text-emerald-600 font-bold"}>
                                    Total: ₹{Object.values(multiPayers).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(2)} / {amount || 0}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Split Between */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Split Between</label>
                    <div className="flex flex-wrap gap-2">
                        {participants.map(p => {
                            const isSelected = consumerIds.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggleConsumer(p.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${isSelected
                                        ? 'bg-gradient-to-r from-teal-400 to-emerald-500 text-white shadow-teal-200'
                                        : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                                        }`}
                                >
                                    {p.name}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 text-xs text-gray-400 font-medium">
                        {consumerIds.length === participants.length ? "Splitting equally among everyone" : `Splitting among ${consumerIds.length} people`}
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    {initialData ? 'Update Expense' : 'Save Expense'}
                </button>
            </form>
        </div>
    );

    if (isInline && !initialData) return content; // If inline creation, just content. 
    // If inline editing, we might use a modal or replace the view. 
    // Let's stick to using modal for "Edit" to differentiate from "Compact Add" to avoid clutter.

    // Actually, user wants editing. Let's make "Edit" always a modal for now to be safe.
    if (isInline && initialData) return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            {content}
        </div>
    );

    if (isInline) return content;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            {content}
        </div>
    );
};

export default AddExpense;
