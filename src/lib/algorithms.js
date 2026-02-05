// Basic equal split logic
export const calculateEqualSplit = (totalAmount, selectedConsumerIds) => {
    if (!selectedConsumerIds.length) return {};
    const splitAmount = parseFloat((totalAmount / selectedConsumerIds.length).toFixed(2));
    const splits = {};

    // Distribute equally
    selectedConsumerIds.forEach(id => {
        splits[id] = splitAmount;
    });

    // Handle rounding difference by adding/subtracting from the first person
    const currentTotal = splitAmount * selectedConsumerIds.length;
    const diff = totalAmount - currentTotal;
    if (Math.abs(diff) > 0.001) {
        splits[selectedConsumerIds[0]] = parseFloat((splits[selectedConsumerIds[0]] + diff).toFixed(2));
    }

    return splits;
};

// ... (existing exports)

export const calculateBalances = (expenses, participants) => {
    const balances = {}; // { userId: netAmount } (+ve means receive, -ve means pay)

    // Initialize 0 for everyone
    participants.forEach(p => balances[p.id] = 0);

    expenses.forEach(expense => {
        const { paidBy, splitBetween } = expense;

        // Add paid amounts (Creditors)
        Object.entries(paidBy).forEach(([userId, amount]) => {
            balances[userId] = (balances[userId] || 0) + amount;
        });

        // Subtract consumed amounts (Debtors)
        Object.entries(splitBetween).forEach(([userId, amount]) => {
            balances[userId] = (balances[userId] || 0) - amount;
        });
    });

    return balances;
};

export const calculateSettlements = (balances) => {
    // Greedy algorithm for minimizing transactions
    // 1. Separate into debtors (-ve) and creditors (+ve)
    let debtors = [];
    let creditors = [];

    Object.entries(balances).forEach(([id, amount]) => {
        if (amount < -0.01) debtors.push({ id, amount }); // Using threshold for float errors
        if (amount > 0.01) creditors.push({ id, amount });
    });

    // Sort by magnitude (heuristic for efficient matching)
    debtors.sort((a, b) => a.amount - b.amount); // Most negative first
    creditors.sort((a, b) => b.amount - a.amount); // Most positive first

    const settlements = [];

    // Two pointers? Or just greedy iteration
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        let debtor = debtors[i];
        let creditor = creditors[j];

        // The amount to settle is min(abs(debt), credit)
        let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        amount = parseFloat(amount.toFixed(2));

        if (amount > 0) {
            settlements.push({
                from: debtor.id,
                to: creditor.id,
                amount
            });
        }

        // Update remaining amounts
        debtor.amount += amount;
        creditor.amount -= amount;

        // If settled (close to 0), move to next
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (Math.abs(creditor.amount) < 0.01) j++;
    }

    return settlements;
};
