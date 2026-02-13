import { fetchDashboardMetrics } from './services/analytics/dashboard.service';
import { fetchClientAnalysisData } from './services/analytics/serviceAnalysis.service';

async function debug() {
    const unitCode = 'mb-teresina';
    const period = '2026-02';
    const previousPeriod = '2026-01';

    try {
        console.log(`Fetching metrics for ${unitCode} in ${period}...`);
        const metrics = await fetchDashboardMetrics(unitCode, period);
        console.log('Metrics:', metrics);

        console.log(`Fetching client analysis for ${unitCode} in ${period}...`);
        const currentData = await fetchClientAnalysisData(unitCode, period);
        const previousPeriodData = await fetchClientAnalysisData(unitCode, previousPeriod);

        const currentClients = currentData.currentMonthClients;
        const previousMonthClients = previousPeriodData.currentMonthClients;

        const recurringCount = [...currentClients].filter(c => previousMonthClients.has(c)).length;
        
        console.log('Current Clients Size:', currentClients.size);
        console.log('Previous Month Clients Size:', previousMonthClients.size);
        console.log('Recurring Count:', recurringCount);
        
        if (recurringCount > metrics.totalServices) {
            console.log('BUG DETECTED: recurringCount > totalServices');
        } else {
            console.log('No bug detected in simple comparison.');
        }

    } catch (error) {
        console.error('Error during debug:', error);
    }
}

debug();
