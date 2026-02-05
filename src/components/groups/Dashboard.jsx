import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';

const Dashboard = () => {
    const { currentUser, logout } = useAuth();
    const [groups, setGroups] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        const q = query(
            collection(db, "groups"),
            where("members", "array-contains", currentUser.uid)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGroups(groupsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        try {
            await addDoc(collection(db, "groups"), {
                name: newGroupName,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                members: [currentUser.uid],
                currency: '₹'
            });
            setNewGroupName('');
            setShowCreateModal(false);
        } catch (error) {
            console.error("Error creating group: ", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans p-6 pb-20">
            {/* Header */}
            <header className="max-w-7xl mx-auto mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Hello, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
                    <p className="text-gray-500 mt-1">Manage all your shared expenses in one place.</p>
                </div>
                <button
                    onClick={() => logout()}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Logout
                </button>
            </header>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Create New Group Button */}
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex flex-col items-center justify-center h-56 rounded-3xl border-2 border-dashed border-gray-300 hover:border-teal-400 hover:bg-teal-50/30 transition group gap-4"
                >
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-300 group-hover:text-teal-500 group-hover:shadow-md transition">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <span className="font-semibold text-gray-500 group-hover:text-teal-600 transition">Create New Group</span>
                </button>

                {/* Group Cards */}
                {groups.map(group => (
                    <div
                        key={group.id}
                        onClick={() => window.location.href = `/group/${group.id}`}
                        className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 cursor-pointer border border-gray-100 group flex flex-col justify-between h-56 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-teal-500/10 to-transparent rounded-bl-full -mr-4 -mt-4 transition group-hover:scale-110"></div>

                        <div>
                            <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mb-4 text-xl font-bold">
                                {group.name.charAt(0).toUpperCase()}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 truncate pr-4">{group.name}</h3>
                            <p className="text-gray-500 text-sm mt-1">{group.participantsList?.length || 1} people</p>
                        </div>

                        <div className="flex items-center gap-2 mt-4 text-teal-600 font-medium text-sm group-hover:gap-3 transition-all">
                            Open Group
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Group Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-800">Plan a new trip</h2>
                        <p className="text-gray-500 mb-6 text-sm">Give your group a catchy name to get started.</p>

                        <form onSubmit={handleCreateGroup}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Group Name</label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="e.g. Summer Vacation 🌴"
                                    className="w-full px-5 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition text-lg font-medium text-gray-800 placeholder-gray-400"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-3 text-gray-500 hover:bg-gray-100 rounded-xl transition font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newGroupName.trim()}
                                    className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition font-bold shadow-lg shadow-teal-200 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Classic
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
