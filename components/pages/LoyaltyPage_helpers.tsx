// Funções auxiliares para LoyaltyPage
export const handleToggleStatus = async (
    planClientId: string,
    currentStatus: boolean,
    toggleClientStatus: Function,
    loadPlanData: Function
) => {
    try {
        await toggleClientStatus(planClientId, !currentStatus);
        loadPlanData();
    } catch (e: any) {
        alert('Erro ao alterar status: ' + e.message);
    }
};

export const handleSaveBalance = async (
    selectedClient: any,
    newBalance: string,
    adjustBalance: Function,
    fetchTransactionsWithUser: Function,
    fetchExpiringPoints: Function,
    setEditingBalance: Function,
    setNewBalance: Function,
    setClientTransactions: Function,
    setExpiringPoints: Function,
    loadPlanData: Function
) => {
    if (!selectedClient) return;

    const points = parseFloat(newBalance);
    if (isNaN(points)) {
        alert('Valor inválido');
        return;
    }

    const diff = points - selectedClient.current_balance;
    if (diff === 0) {
        setEditingBalance(false);
        return;
    }

    try {
        const userId = selectedClient.client_id;
        const reason = diff > 0 ? 'Adição manual de pontos' : 'Remoção manual de pontos';

        await adjustBalance(selectedClient.id, diff, reason, userId);
        setEditingBalance(false);
        setNewBalance('');

        const [transactions, expiring] = await Promise.all([
            fetchTransactionsWithUser(selectedClient.id),
            fetchExpiringPoints(selectedClient.id)
        ]);
        setClientTransactions(transactions);
        setExpiringPoints(expiring);
        loadPlanData();
    } catch (e: any) {
        alert('Erro ao ajustar saldo: ' + e.message);
    }
};
