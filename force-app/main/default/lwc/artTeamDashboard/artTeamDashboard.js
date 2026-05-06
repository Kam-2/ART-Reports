import { LightningElement, api, track } from 'lwc';

export default class ArtTeamDashboard extends LightningElement {

    _data;

    @track isloading = false;
    @track lastSync = '';

    @track pageSize = 20;
    @track currentPage = 1;

    columns = [
        { label: 'Date', fieldName: 'date' },
        { label: 'Team', fieldName: 'team' },
        { label: 'Distance Covered', fieldName: 'distance' },
        { label: 'Hours Worked', fieldName: 'hours' },
        { label: 'Checkpoints Completed', fieldName: 'completed' },
        { label: 'Checkpoints Missed', fieldName: 'missed' },
        { label: 'Checkpoints Completed %', fieldName: 'completedPct' },
        { label: 'Checkpoints Missed %', fieldName: 'missedPct' },
        { label: 'Avg Speed', fieldName: 'avgSpeed' }
    ];

    // ✅ SAFE API SETTER
    @api
    set data(value) {
        if (!value) {
            this._data = null;
            return;
        }

        let obj = value;

        if (typeof value === 'string') {
            try {
                obj = JSON.parse(value);
            } catch (e) {
                console.error('Parse error', e);
                this._data = null;
                return;
            }
        }

        this._data = obj;
        this.currentPage = 1;

        const apiData = obj?.data || obj;

        this.lastSync = this.formatDate(apiData?.period?.last_sync_at);
    }

    get data() {
        return this._data;
    }
    get hasTeamData() {
    return this.teamTableData && this.teamTableData.length > 0;
}

    // 📊 PAGINATED DATA
    get teamTableData() {
        return this.paginateData(this.fullData || []);
    }

    // 📊 FULL DATA GROUPING
    get fullData() {
        try {
            const apiData = this.data?.data || this.data;

            if (!apiData?.ambassadors) return [];

            const dateVal = this.formatDate(apiData?.period?.end_date);
            const lastSync = this.formatDate(apiData?.period?.last_sync_at);

            const teamMap = {};

            apiData.ambassadors.forEach(a => {

                const teamName = a.team_name || 'No Team';

                if (!teamMap[teamName]) {
                    teamMap[teamName] = {
                        id: teamName,
                        date: dateVal,
                        team: teamName,
                        distance: 0,
                        hours: 0,
                        completed: 0,
                        missed: 0,
                        completedPct: 0,
                        missedPct: 0,
                        avgSpeed: 0,
                        lastSync,
                        count: 0
                    };
                }

                const team = teamMap[teamName];

                team.distance += Math.round(((a.total_distance_km || 0) * 0.621371) * 100) / 100;

                team.completed += a.total_checkpoints_completed || 0;
                team.missed += a.total_checkpoints_missed || 0;

                // ✅ FIX: accumulate instead of overwrite
                team.hours = a.total_working_hours;

                team.avgSpeed += a.average_speed_kmh || 0;

                team.completedPct += (a.checkpoint_completed_percentage || 0);
                team.missedPct += (a.checkpoint_missed_percentage || 0);

                team.count++;
            });

            return Object.values(teamMap).map(t => ({
                ...t,
                avgSpeed: t.count ? (t.avgSpeed / t.count).toFixed(2) : 0,
                completedPct: t.count ? (t.completedPct / t.count).toFixed(1) + '%' : '0%',
                missedPct: t.count ? (t.missedPct / t.count).toFixed(1) + '%' : '0%'
            }));

        } catch (e) {
            console.error('Grouping error', e);
            return [];
        }
    }

    // 📄 PAGINATION
    paginateData(data) {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = this.currentPage * this.pageSize;
        return data.slice(start, end);
    }

    get totalPages() {
        return Math.max(1, Math.ceil((this.fullData?.length || 0) / this.pageSize));
    }

    get isPreviousDisabled() {
        return this.currentPage <= 1;
    }

    get isNextDisabled() {
        return this.currentPage >= this.totalPages;
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    // 📅 DATE FORMAT
    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    }

    // 📤 EXPORT CSV
    handleExport() {
        const records = this.fullData;

        if (!records.length) {
            alert('No data to export');
            return;
        }

        let csv = 'Date,Team,Distance,Hours,Completed,Missed,Completed %,Missed %,Avg Speed,Last Sync\n';

        records.forEach(r => {
            const row = [
                r.date,
                r.team,
                r.distance,
                r.hours,
                r.completed,
                r.missed,
                r.completedPct,
                r.missedPct,
                r.avgSpeed,
                this.lastSync
            ].map(v => `"${v ?? ''}"`).join(',');

            csv += row + '\n';
        });

        const fileName = `Team_Performance_${new Date().toISOString().split('T')[0]}.csv`;

        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    connectedCallback() {
        console.log('Child loaded:', this.data);
    }
}