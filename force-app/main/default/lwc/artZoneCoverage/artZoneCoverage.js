import { LightningElement, api, track } from 'lwc';

export default class ArtZoneCoverage extends LightningElement {

    @track tableData = [];
    _data;

    @api isLoading = false;
    @api error;

    @track totalZones;
    @track totalAmbassadors;
    @track lastSyncAt;

    @track pageSize = 10;
    @track currentPage = 1;
    @track totalRecords = 0;

    @track sortedBy;
    @track sortedDirection = 'asc';

    allData = [];

    columns = [
        { label: 'Date', fieldName: 'date' },
        { label: 'Zone', fieldName: 'zone_name' },
        { label: 'Ambassador', fieldName: 'ambassador_name', sortable: true },
        { label: 'Team', fieldName: 'team_name' },
        { label: 'Total Hours Spent', fieldName: 'hours_spent' },
        { label: 'Hours Spent On Assigned Zone', fieldName: 'assigned_zone_hours' },
        { label: 'Visits', fieldName: 'visits', type: 'number' },
        { label: 'Last Visit', fieldName: 'last_visit' }
    ];

    @api
    get data() {
        return this._data;
    }

    set data(value) {
        this._data = value;

        console.log('Child received:', JSON.stringify(value));

        // ✅ FIX: direct response
        if (!value || !value.data) {
            this.tableData = [];
            this.allData = [];
            return;
        }

        const records = value.data;

        // ✅ Summary
        this.totalZones = value.summary?.total_zones || 0;
        this.totalAmbassadors = value.summary?.total_ambassadors || 0;

        // ✅ Last Sync
        this.lastSyncAt = value.period?.last_sync_at
            ? new Date(value.period.last_sync_at).toLocaleString()
            : '';

        // ✅ Common Date
        const reportDate = value.period?.end_date
            ? new Date(value.period.end_date).toLocaleDateString()
            : '';

        // ✅ Mapping
        let flat = records.map(rec => ({

            id: rec.ambassador_id,

            date: reportDate,

            zone_name: rec.assigned_zone?.zone_name || 'N/A',

            ambassador_name: rec.ambassador_name || '',
            team_name: rec.team_name || '',

            hours_spent: rec.total_tracked_hours || '0s',
            assigned_zone_hours: rec.assigned_zone_tracked_hours || '0s',

            visits: Number(rec.total_visits) || 0,

            last_visit: rec.last_visit
                ? new Date(rec.last_visit).toLocaleDateString()
                : ''
        }));

        this.allData = flat;
        this.totalRecords = flat.length;

        this.currentPage = 1;
        this.updatePagination();
    }

    // Pagination
    updatePagination() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.tableData = this.allData.slice(start, end);
    }

    handleNext() {
        if (this.currentPage * this.pageSize < this.totalRecords) {
            this.currentPage++;
            this.updatePagination();
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagination();
        }
    }

    get isPreviousDisabled() {
        return this.currentPage === 1;
    }

    get isNextDisabled() {
        return this.currentPage * this.pageSize >= this.totalRecords;
    }

    get hasData() {
        return this.tableData.length > 0;
    }

    // =========================================================================
    // SORTING (FIXED)
    // =========================================================================
    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;

        this.sortedBy        = fieldName;
        this.sortedDirection = sortDirection;

        const cloneData = [...this.allData];

        cloneData.sort((a, b) => {
            let val1 = a[fieldName];
            let val2 = b[fieldName];

            // ✅ Handle date fields properly
            if (fieldName === 'date') {
                val1 = a.dateRaw || new Date(0);
                val2 = b.dateRaw || new Date(0);
            }

            if (fieldName === 'last_visit') {
                val1 = a.lastVisitRaw || new Date(0);
                val2 = b.lastVisitRaw || new Date(0);
            }

            // ✅ Normalize nulls
            val1 = val1 ?? '';
            val2 = val2 ?? '';

            return sortDirection === 'asc'
                ? val1 > val2 ? 1 : -1
                : val1 < val2 ? 1 : -1;
        });

        this.allData = cloneData;

        // ✅ Reset pagination after sort (important)
        this.currentPage = 1;

        this.updatePagination();
    }

    // =========================================================================
    // CSV EXPORT
    // =========================================================================
    handleExport() {
        if (!this.allData.length) {
            alert('No data to export');
            return;
        }

        const headers = ['Date', 'Zone', 'Ambassador', 'Team', 'Hours Spent', 'Visits', 'Last Visit'];

        const rows = this.allData.map(row =>
            [
                row.date,
                row.zone_name,
                row.ambassador_name,
                row.team_name,
                row.hours_spent,
                row.visits,
                row.last_visit
            ].map(val => `"${val ?? ''}"`).join(',')
        );

        const csv = [headers.join(','), ...rows].join('\n');

        const today    = new Date().toISOString().split('T')[0];
        const fileName = `Zone_Coverage_Report_${today}.csv`;

        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

        const link = document.createElement('a');
        link.href = encodedUri;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}